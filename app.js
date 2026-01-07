// Data definitions moved to data.js

let calculatedResults = []; // Store results to access in selectCylinder
let isEditMode = false; // Track if we are editing an existing project
let pendingUpdateData = null; // Store data for confirmation
let originalProjectState = null; // For dirty checking

function getFormData() {
    return {
        customerName: document.getElementById('customerName').value,
        inputs: {
            capacity: document.getElementById('capacity').value,
            carcassWeight: document.getElementById('carcassWeight').value,
            travelDistance: document.getElementById('travelDistance').value,
            buffer: Number(document.getElementById('buffer').value) || 300,
            speed: document.getElementById('speed').value,
            suspension: document.getElementById('suspension').value,
            cylinderCount: document.getElementById('cylinderCount').value,
            regulation: document.getElementById('regulation').value,
            buildingType: document.getElementById('buildingType').value
        },
        components: {
            motor: document.getElementById('motorSelect') ? document.getElementById('motorSelect').value : null,
            pump: document.getElementById('pumpSelect') ? document.getElementById('pumpSelect').value : null,
            powerUnit: document.getElementById('powerUnitSelect') ? document.getElementById('powerUnitSelect').value : null,
            ruptureValve: document.getElementById('ruptureSelect') ? document.getElementById('ruptureSelect').value : null,
            mainValve: document.getElementById('mainValveSelect') ? document.getElementById('mainValveSelect').value : null,
            voltage: document.getElementById('voltageSelect') ? document.getElementById('voltageSelect').value : null,
            twoPieceCylinder: document.getElementById('twoPieceCylinder') ? document.getElementById('twoPieceCylinder').checked : false,
            hoses: {
                mainDiameter: document.getElementById('mainHoseDiameter') ? document.getElementById('mainHoseDiameter').value : null,
                mainLength: document.getElementById('mainHoseLength') ? document.getElementById('mainHoseLength').value : null,
                cylinderDiameter: document.getElementById('cylinderHoseDiameter') ? document.getElementById('cylinderHoseDiameter').value : null,
                cylinderLength: document.getElementById('cylinderHoseLength') ? document.getElementById('cylinderHoseLength').value : null
            },
            allAccessories: accessories.filter(item => item.included).map(item => item.name),
            pressureSwitches: accessories.filter(item => item.included && item.category === 'Güvenlik' && item.name.includes('Şalteri')).map(item => item.name)
        }
        // distinct from full project data which includes history/meta
    };
}

function checkForChanges() {
    if (!isEditMode || !originalProjectState) return;

    const currentData = getFormData();
    // Reconstruct a simpler version of original state for comparison to match getFormData structure
    const original = JSON.parse(originalProjectState);

    // We only compare editable fields. 
    // Construct comparable objects
    const cleanOriginal = {
        customerName: original.customerName,
        inputs: original.inputs,
        components: original.components
    };

    // Need to handle nulls vs empty strings or types potentially mismatching if not careful
    // JSON.stringify comparison is simplest but sensitive to order. 
    // Since getFormData creates a fixed structure, it should be stable if values are stable.  

    // However, existing data might have extra keys or missing keys in inputs/components.
    // It is safer to check equality of specific known fields deep equal or stringify.

    // For now, let's try direct stringify of the structured data.
    const currentStr = JSON.stringify(currentData);
    const originalStr = JSON.stringify(cleanOriginal);

    const btn = document.getElementById('headerSaveBtn');
    if (currentStr !== originalStr) {
        btn.disabled = false;
        btn.classList.remove('opacity-50', 'cursor-not-allowed');
    } else {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'cursor-not-allowed');
    }
}


/* ---------------------------------------------------------------
   COST CALCULATION FUNCTIONS
   --------------------------------------------------------------- */
function calculateCylinderPrice(cylinderType, strokeMeters, quantity, isTwoPiece = false) {
    // cylinderType format: "80x10" (diameter x thickness)
    const pricing = cylinderPricing[cylinderType];

    if (!pricing) {
        console.warn(`Pricing not found for cylinder type: ${cylinderType}`);
        return 0;
    }

    // Base calculation: Fixed + (PerMeter × Stroke)
    let baseCost = pricing.fixed + (pricing.perMeter * strokeMeters);

    // Add "Additional" cost if two-piece cylinder
    if (isTwoPiece) {
        baseCost += pricing.additional;
    }

    // Apply profit margins: First 16%, then 30%
    // Formula: ((baseCost × 1.16) × 1.30) = baseCost × 1.508
    const pricePerCylinder = baseCost * 1.16 * 1.30;

    return pricePerCylinder * quantity;
}

function calculateSystemCost(selectedComponents) {
    let totalCost = 0;
    const breakdown = {
        cylinders: 0,
        motor: 0,
        pump: 0,
        powerUnit: 0, // Includes hose cost if "Güç Ünitesi Hortumları" is selected
        powerUnitHoseCost: 0, // Track separately for display
        ruptureValve: 0,
        mainValve: 0,
        accessories: 0
    };

    // Cylinders
    if (selectedComponents.cylinder) {
        const { cylinderType, strokeMeters, quantity, isTwoPiece } = selectedComponents.cylinder;
        breakdown.cylinders = calculateCylinderPrice(cylinderType, strokeMeters, quantity, isTwoPiece);
    }

    // Motor (fixed price - no profit margin)
    if (selectedComponents.motorName) {
        const motor = motors.find(m => m.name === selectedComponents.motorName);
        if (motor) breakdown.motor = motor.price;
    }

    // Pump (fixed price - no profit margin)
    if (selectedComponents.pumpName) {
        const pump = pumps.find(p => p.name === selectedComponents.pumpName);
        if (pump) breakdown.pump = pump.price;
    }

    // Power Unit (fixed price, no profit margin)
    // Add calculated hose cost if "Güç Ünitesi Hortumları" is selected
    if (selectedComponents.powerUnitName) {
        const unit = powerUnits.find(u => u.model === selectedComponents.powerUnitName);
        if (unit) {
            breakdown.powerUnit = unit.price;
            console.log('Power unit base price:', unit.price);

            // Check if power unit hoses accessory is selected
            const powerUnitHosesSelected = selectedComponents.accessories &&
                selectedComponents.accessories.includes("Güç Ünitesi Hortumları");

            console.log('Power unit hoses selected:', powerUnitHosesSelected);
            console.log('Hoses data:', selectedComponents.hoses);

            if (powerUnitHosesSelected && selectedComponents.hoses) {
                // Add the calculated hose cost to power unit price
                const { mainDiameter, mainLength, cylinderDiameter, cylinderLength, cylinderCount } = selectedComponents.hoses;
                const hoseCost = calculateHoseCost(mainDiameter, mainLength, cylinderDiameter, cylinderLength, cylinderCount);
                console.log('Calculated hose cost:', hoseCost);
                breakdown.powerUnit += hoseCost;
                breakdown.powerUnitHoseCost = hoseCost;
                console.log('Power unit final price:', breakdown.powerUnit);
            }
        }
    }

    // Rupture Valve (R10)
    if (selectedComponents.ruptureValveName && selectedComponents.ruptureValveName !== "Yok") {
        console.log('Looking for rupture valve:', selectedComponents.ruptureValveName);
        const ruptureValve = burstHoseValves.find(v => v.name === selectedComponents.ruptureValveName);
        console.log('Found rupture valve:', ruptureValve);
        if (ruptureValve) {
            // Price is multiplied by cylinder quantity
            const qty = selectedComponents.cylinder ? selectedComponents.cylinder.quantity : 1;
            breakdown.ruptureValve = ruptureValve.price * qty;
        } else {
            console.warn('Rupture valve not found in burstHoseValves array');
        }
    }

    // Main Valve (Ana Kontrol Valfi)
    if (selectedComponents.mainValveName) {
        const mainValve = mainValves.find(v => v.name === selectedComponents.mainValveName);
        if (mainValve) {
            breakdown.mainValve = mainValve.price;
        }
    }

    // Note: Hose cost is already included in power unit price when "Güç Ünitesi Hortumları" is selected

    // Accessories
    if (selectedComponents.accessories && Array.isArray(selectedComponents.accessories)) {
        selectedComponents.accessories.forEach(accName => {
            // Skip "Güç Ünitesi Hortumları" as it is added to powerUnit price dynamically
            if (accName === "Güç Ünitesi Hortumları") return;

            // Handle dynamic pricing for "Küresel Vana BG"
            if (accName === "Küresel Vana BG") {
                let ballValvePrice = 0;
                const mainValveName = selectedComponents.mainValveName || "";

                if (mainValveName.includes("KV")) {
                    ballValvePrice = 24;
                } else if (mainValveName.includes("0,75'' EV100") || mainValveName.includes("0.75'' EV100")) {
                    ballValvePrice = 42;
                } else if (mainValveName.includes("1,5'' EV100") || mainValveName.includes("1.5'' EV100")) {
                    ballValvePrice = 67;
                } else if (mainValveName.includes("2'' EV100") || mainValveName.includes("2.0'' EV100")) {
                    ballValvePrice = 77;
                } else {
                    // Fallback or default if main valve not recognized or empty
                    // Assuming smallest size or 0 if strictly dependent
                    ballValvePrice = 42; // Default to 3/4" price as safe fallback
                }
                breakdown.accessories += ballValvePrice;
                return;
            }

            const acc = accessories.find(a => a.name === accName);
            if (acc) {
                breakdown.accessories += acc.price;
                console.log(`Accessory ${accName} price: ${acc.price}`);
            } else {
                console.warn(`Accessory ${accName} not found`);
            }
        });
    }

    totalCost = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

    return { totalCost, breakdown };
}

/* ---------------------------------------------------------------
   THERMAL ANALYSIS FUNCTIONS
   --------------------------------------------------------------- */
function calculateHeatGeneration(motorPower, pumpFlow, pressure, tripsPerHour, travelTime) {
    // Heat generated per cycle (kJ)
    // Q = P * t * efficiency_loss
    // Assuming 15% energy loss as heat
    const cycleTime = travelTime; // seconds
    const powerKW = motorPower;
    const heatPerCycle = powerKW * cycleTime * 0.15; // kJ

    // Total heat per hour
    const heatPerHour = heatPerCycle * tripsPerHour; // kJ/h

    return heatPerHour;
}

function calculateOilTemperatureRise(heatPerHour, oilVolume, ambientTemp = 25) {
    // Oil properties
    const oilDensity = 870; // kg/m³
    const oilSpecificHeat = 2.0; // kJ/(kg·°C)
    const oilMass = (oilVolume / 1000) * oilDensity; // kg

    // Temperature rise per hour (assuming no cooling)
    // ΔT = Q / (m * c)
    const tempRisePerHour = heatPerHour / (oilMass * oilSpecificHeat);

    // Estimated steady-state temperature (with natural cooling)
    // Simplified model: assume 30% heat dissipation
    const steadyStateTemp = ambientTemp + (tempRisePerHour * 0.7);

    return {
        tempRisePerHour: tempRisePerHour.toFixed(1),
        steadyStateTemp: steadyStateTemp.toFixed(1),
        needsCooling: steadyStateTemp > 55 // Oil should stay below 55°C
    };
}

function performThermalAnalysis(inputs, selectedComponents) {
    const { speed, travelDistance, tripsPerHour } = inputs;
    const { motorPower, pumpFlow, pressure, oilVolume } = selectedComponents;

    // Calculate travel time
    const travelMeters = travelDistance / 1000;
    const travelTime = travelMeters / speed; // seconds

    // Heat generation
    const heatPerHour = calculateHeatGeneration(motorPower, pumpFlow, pressure, tripsPerHour, travelTime);

    // Temperature analysis
    const thermalResult = calculateOilTemperatureRise(heatPerHour, oilVolume);

    return {
        heatPerHour: heatPerHour.toFixed(0),
        ...thermalResult,
        recommendation: thermalResult.needsCooling
            ? "⚠️ Soğutucu (Cooler) önerilir"
            : "✅ Doğal soğutma yeterli"
    };
}


/* ---------------------------------------------------------------
   USER ACTIVITY LOGGING
   --------------------------------------------------------------- */
function logChange(action, details) {
    try {
        const userObj = JSON.parse(localStorage.getItem('currentUser') || '{}');
        const username = userObj.username || 'unknown';
        const logEntry = {
            user: username,
            action: action,
            details: details,
            timestamp: new Date().toISOString()
        };
        const logs = JSON.parse(localStorage.getItem('changeLogs') || '[]');
        logs.push(logEntry);
        localStorage.setItem('changeLogs', JSON.stringify(logs));
    } catch (e) {
        console.warn('LocalStorage access failed in logChange:', e);
    }
}


// Project Number Management
async function generateProjectNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const currentPrefix = `${year}-${month}`;

    try {
        // Fetch last project from DB
        const lastProject = await db.projects.getLast();
        let nextCounter = 1;

        if (lastProject && lastProject.project_number) {
            const parts = lastProject.project_number.split('-');
            if (parts.length === 3) {
                const lastPrefix = `${parts[0]}-${parts[1]}`;
                if (lastPrefix === currentPrefix) {
                    const lastCounter = parseInt(parts[2]);
                    if (!isNaN(lastCounter)) {
                        nextCounter = lastCounter + 1;
                    }
                }
            }
        }

        return `${currentPrefix}-${String(nextCounter).padStart(4, '0')}`;
    } catch (e) {
        console.warn('Failed to generate sequential ID:', e);
        // Fallback to timestamp if offline or error
        return `${currentPrefix}-${Date.now().toString().slice(-4)}`;
    }
}

async function initializeProjectNumber() {
    const projectNumberInput = document.getElementById('projectNumber');
    if (projectNumberInput) {
        projectNumberInput.value = 'Yükleniyor...';
        projectNumberInput.value = await generateProjectNumber();
    }
}

// Initialize project number on page load
document.addEventListener('DOMContentLoaded', () => {
    initializeProjectNumber();

    // Check if there is a pending project to load (from redirection)
    const projectToLoad = localStorage.getItem('projectToLoad');
    if (projectToLoad) {
        localStorage.removeItem('projectToLoad'); // Clear it so it doesn't persist
        // Slight delay to ensure DOM is fully ready
        setTimeout(() => loadProject(projectToLoad), 100);
    }
});

// Function to reset to new project mode
async function resetToNewProject() {
    // Clear form fields
    document.getElementById('customerName').value = '';
    document.getElementById('capacity').value = '';
    document.getElementById('carcassWeight').value = '';
    document.getElementById('travelDistance').value = '';
    document.getElementById('buffer').value = '';
    document.getElementById('speed').value = '';
    document.getElementById('suspension').value = '2:1';
    document.getElementById('cylinderCount').value = '1';

    // Clear results
    selectedCylinder = null;
    calculatedResults = [];
    document.getElementById('resultsSection').classList.add('hidden');
    const selectionSection = document.getElementById('selectionSection');
    if (selectionSection) selectionSection.classList.add('hidden');

    // Generate new project number
    document.getElementById('projectNumber').value = 'Yükleniyor...';
    try {
        const projectNumber = await generateProjectNumber();
        document.getElementById('projectNumber').value = projectNumber;
    } catch (e) {
        console.error(e);
    }

    // Reset state to New Project
    isEditMode = false;
    const headerBtn = document.getElementById('headerSaveBtn');
    if (headerBtn) {
        headerBtn.innerHTML = '<i class="ri-save-3-line"></i> Projeyi Kaydet';
        headerBtn.disabled = true;
    }

    // Disable header save button until selection is made
    const headerSaveBtn = document.getElementById('headerSaveBtn');
    if (headerSaveBtn) headerSaveBtn.disabled = true;
}

// Project Save/Load Management
function saveOrUpdateProject() {
    if (isEditMode) {
        updateProject();
    } else {
        saveProject();
    }
}

async function saveProject() {
    const customerName = document.getElementById('customerName').value;
    if (!customerName) {
        showStatusModal('Uyarı', 'Lütfen müşteri adını girin!', 'warning');
        return;
    }
    // Use existing project number or generate new one
    let projectNumber = document.getElementById('projectNumber').value;
    if (!projectNumber || projectNumber === 'Yükleniyor...') {
        projectNumber = await generateProjectNumber();
        document.getElementById('projectNumber').value = projectNumber;
    }

    // Collect all form data
    const projectData = {
        project_number: projectNumber, // DB column name
        customer_name: customerName,
        status: 'draft',
        inputs: {
            capacity: document.getElementById('capacity').value,
            carcassWeight: document.getElementById('carcassWeight').value,
            travelDistance: document.getElementById('travelDistance').value,
            buffer: Number(document.getElementById('buffer').value) || 300,
            speed: document.getElementById('speed').value,
            suspension: document.getElementById('suspension').value,
            cylinderCount: document.getElementById('cylinderCount').value,
            regulation: document.getElementById('regulation').value,
            buildingType: document.getElementById('buildingType').value
        },
        selected_cylinder: selectedCylinder,
        components: {
            motor: document.getElementById('motorSelect') ? document.getElementById('motorSelect').value : null,
            pump: document.getElementById('pumpSelect') ? document.getElementById('pumpSelect').value : null,
            powerUnit: document.getElementById('powerUnitSelect') ? document.getElementById('powerUnitSelect').value : null,
            ruptureValve: document.getElementById('ruptureSelect') ? document.getElementById('ruptureSelect').value : null,
            mainValve: document.getElementById('mainValveSelect') ? document.getElementById('mainValveSelect').value : null,
            voltage: document.getElementById('voltageSelect') ? document.getElementById('voltageSelect').value : null,
            twoPieceCylinder: document.getElementById('twoPieceCylinder') ? document.getElementById('twoPieceCylinder').checked : false,
            hoses: {
                mainDiameter: document.getElementById('mainHoseDiameter') ? document.getElementById('mainHoseDiameter').value : null,
                mainLength: document.getElementById('mainHoseLength') ? document.getElementById('mainHoseLength').value : null,
                cylinderDiameter: document.getElementById('cylinderHoseDiameter') ? document.getElementById('cylinderHoseDiameter').value : null,
                cylinderLength: document.getElementById('cylinderHoseLength') ? document.getElementById('cylinderHoseLength').value : null
            },
            allAccessories: accessories.filter(item => item.included).map(item => item.name),
            pressureSwitches: accessories.filter(item => item.included && item.category === 'Güvenlik' && item.name.includes('Şalteri')).map(item => item.name)
        },
        created_by: Auth.getCurrentUser()?.username || 'Misafir'
    };

    try {
        await db.projects.create(projectData);
        showSuccessModal(`Proje ${projectNumber} başarıyla kaydedildi!`);
        loadProjectsList();

        // Switch to Edit Mode
        isEditMode = true;
        const headerBtn = document.getElementById('headerSaveBtn');
        if (headerBtn) {
            headerBtn.innerHTML = '<i class="ri-refresh-line"></i> Projeyi Güncelle';
        }
    } catch (e) {
        showStatusModal('Hata', 'Kayıt başarısız: ' + e.message, 'error');
    }
}

async function updateProject() {
    const customerName = document.getElementById('customerName').value;
    const projectNumber = document.getElementById('projectNumber').value;

    if (!customerName) {
        showStatusModal('Uyarı', 'Lütfen müşteri adını girin!', 'warning');
        return;
    }

    if (!projectNumber) {
        showStatusModal('Uyarı', 'Güncellenecek proje bulunamadı!', 'warning');
        return;
    }

    try {
        const projects = await db.projects.getAll();
        const oldProject = projects.find(p => p.project_number === projectNumber);

        if (!oldProject) {
            showStatusModal('Hata', '⚠️ Proje veritabanında bulunamadı!', 'error');
            return;
        }

        const projectData = {
            project_number: projectNumber,
            customer_name: customerName,
            updated_at: new Date().toISOString(),
            status: oldProject.status || 'draft',
            selected_cylinder: selectedCylinder,
            inputs: {
                capacity: document.getElementById('capacity').value,
                carcassWeight: document.getElementById('carcassWeight').value,
                travelDistance: document.getElementById('travelDistance').value,
                buffer: Number(document.getElementById('buffer').value) || 300,
                speed: document.getElementById('speed').value,
                suspension: document.getElementById('suspension').value,
                cylinderCount: document.getElementById('cylinderCount').value,
                regulation: document.getElementById('regulation').value,
                buildingType: document.getElementById('buildingType').value
            },
            components: {
                motor: document.getElementById('motorSelect') ? document.getElementById('motorSelect').value : null,
                pump: document.getElementById('pumpSelect') ? document.getElementById('pumpSelect').value : null,
                powerUnit: document.getElementById('powerUnitSelect') ? document.getElementById('powerUnitSelect').value : null,
                ruptureValve: document.getElementById('ruptureSelect') ? document.getElementById('ruptureSelect').value : null,
                mainValve: document.getElementById('mainValveSelect') ? document.getElementById('mainValveSelect').value : null,
                voltage: document.getElementById('voltageSelect') ? document.getElementById('voltageSelect').value : null,
                twoPieceCylinder: document.getElementById('twoPieceCylinder') ? document.getElementById('twoPieceCylinder').checked : false,
                hoses: {
                    mainDiameter: document.getElementById('mainHoseDiameter') ? document.getElementById('mainHoseDiameter').value : null,
                    mainLength: document.getElementById('mainHoseLength') ? document.getElementById('mainHoseLength').value : null,
                    cylinderDiameter: document.getElementById('cylinderHoseDiameter') ? document.getElementById('cylinderHoseDiameter').value : null,
                    cylinderLength: document.getElementById('cylinderHoseLength') ? document.getElementById('cylinderHoseLength').value : null
                },
                allAccessories: accessories.filter(item => item.included).map(item => item.name),
                pressureSwitches: accessories.filter(item => item.included && item.category === 'Güvenlik' && item.name.includes('Şalteri')).map(item => item.name)
            }
        };

        await db.projects.update(oldProject.id, projectData);
        showSuccessModal(`Proje ${projectNumber} başarıyla güncellendi!`);

    } catch (e) {
        showStatusModal('Hata', 'Güncelleme başarısız: ' + e.message, 'error');
    }
}

function showStatusModal(title, message, type = 'success') {
    const modal = document.getElementById('statusModal');
    const iconContainer = document.getElementById('statusIconContainer');
    const icon = document.getElementById('statusIcon');
    const titleEl = document.getElementById('statusTitle');
    const messageEl = document.getElementById('statusMessage');

    // Reset Classes
    iconContainer.className = '';
    icon.className = '';

    // Configure based on type
    if (type === 'success') {
        iconContainer.classList.add('status-success-bg');
        icon.classList.add('ri-check-line');
        // Keep existing green color for success icon via class or inherit
        icon.style.color = '#16a34a';
    } else if (type === 'warning') {
        iconContainer.classList.add('status-warning-bg');
        icon.classList.add('ri-alert-line');
        icon.style.color = '#d97706';
    } else if (type === 'error') {
        iconContainer.classList.add('status-error-bg');
        icon.classList.add('ri-error-warning-line');
        icon.style.color = '#dc2626';
    }

    titleEl.textContent = title;
    messageEl.textContent = message;

    modal.classList.remove('hidden');
}

function closeStatusModal() {
    document.getElementById('statusModal').classList.add('hidden');
}

// Confirmation Modal Logic
let currentConfirmCallback = null;

function showConfirmationModal(title, message, callback) {
    const modal = document.getElementById('confirmationModal');
    const titleEl = document.getElementById('confirmTitle');
    const messageEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmActionBtn');

    titleEl.textContent = title;
    messageEl.textContent = message;
    currentConfirmCallback = callback;

    // Set up the confirm button action
    confirmBtn.onclick = function () {
        if (currentConfirmCallback) currentConfirmCallback();
        closeConfirmationModal();
    };

    modal.classList.remove('hidden');
    modal.style.display = 'flex';
}

function closeConfirmationModal() {
    const modal = document.getElementById('confirmationModal');
    modal.classList.add('hidden');
    modal.style.display = 'none';
    currentConfirmCallback = null;
}

// Wrapper for existing calls (Backward Compatibility)
function showSuccessModal(message) {
    showStatusModal('Başarılı!', message, 'success');
}

function closeSuccessModal() {
    closeStatusModal();
}

async function loadProject(projectNumber) {
    try {
        const projects = await db.projects.getAll();
        const project = projects.find(p => p.project_number === projectNumber);

        if (!project) {
            showStatusModal('Hata', 'Proje bulunamadı!', 'error');
            return;
        }

        // If not on index.html, redirect
        if (!document.getElementById('customerName')) {
            // We are on a different page (e.g. all-projects), need to go to index
            // Store intent in localStorage (temporary) to load after redirect.
            // But wait, if we are loading from DB, we can just pass ID?
            // Re-using the localStorage redirect mechanism for simplicity across pages.
            localStorage.setItem('projectToLoad', projectNumber);
            window.location.href = 'index.html';
            return;
        }

        // Populate Form
        document.getElementById('projectNumber').value = project.project_number;
        document.getElementById('customerName').value = project.customer_name || '';

        // Safe Input Population
        const inputs = project.inputs || {};
        if (document.getElementById('capacity')) document.getElementById('capacity').value = inputs.capacity || '';
        if (document.getElementById('carcassWeight')) document.getElementById('carcassWeight').value = inputs.carcassWeight || '';
        if (document.getElementById('travelDistance')) document.getElementById('travelDistance').value = inputs.travelDistance || '';
        if (document.getElementById('buffer')) document.getElementById('buffer').value = inputs.buffer || '';
        if (document.getElementById('speed')) document.getElementById('speed').value = inputs.speed || '';
        if (document.getElementById('suspension')) document.getElementById('suspension').value = inputs.suspension || '2:1';
        if (document.getElementById('cylinderCount')) document.getElementById('cylinderCount').value = inputs.cylinderCount || '1';
        if (document.getElementById('regulation')) document.getElementById('regulation').value = inputs.regulation || 'EN 81-20';
        if (document.getElementById('buildingType')) document.getElementById('buildingType').value = inputs.buildingType || '10';

        // Re-calculate to show results
        calculate();

        // Restore Selections (needs a slight delay for calculation to finish rendering)
        setTimeout(() => {
            if (project.selected_cylinder) {
                // Determine scrolling logic: if we are loading, maybe scroll to it?
                selectCylinder(project.selected_cylinder, true);

                // Restore Components Checks after selection section rendered
                setTimeout(() => {
                    const comps = project.components || {};

                    // Restore Two Piece
                    const twoPiece = document.getElementById('twoPieceCylinder');
                    if (twoPiece) twoPiece.checked = comps.twoPieceCylinder || false;

                    // Restore Accessories
                    const accList = comps.allAccessories || [];
                    accessories.forEach((acc, idx) => {
                        acc.included = accList.includes(acc.name);
                        // Update UI checkbox if exists?
                        // Actually accessories array is source of truth for rendering?
                        // renderSelection re-renders accessories based on `accessories` global.
                        // We need to update global `accessories` state first?
                        // Yes line 37 in getFormData reads from global accessories.
                        // So we must update global state.
                    });

                    // Re-render selection to reflect accessories
                    // This is tricky because selectCylinder calls renderSelection which renders from scratch.
                    // But selectCylinder uses logic to recommend things.
                    // If we saved *specific* selections (overriding recommendations), we need to set them.

                    // For now, let's just update the UI elements IF they match recommendations or just override values.
                    if (document.getElementById('motorSelect') && comps.motor) document.getElementById('motorSelect').value = comps.motor;
                    if (document.getElementById('pumpSelect') && comps.pump) document.getElementById('pumpSelect').value = comps.pump;
                    if (document.getElementById('powerUnitSelect') && comps.powerUnit) document.getElementById('powerUnitSelect').value = comps.powerUnit;
                    if (document.getElementById('mainValveSelect') && comps.mainValve) document.getElementById('mainValveSelect').value = comps.mainValve;
                    if (document.getElementById('ruptureSelect') && comps.ruptureValve) document.getElementById('ruptureSelect').value = comps.ruptureValve;
                    if (document.getElementById('voltageSelect') && comps.voltage) document.getElementById('voltageSelect').value = comps.voltage;

                    // Restore Hoses
                    if (comps.hoses) {
                        if (document.getElementById('mainHoseDiameter')) document.getElementById('mainHoseDiameter').value = comps.hoses.mainDiameter;
                        if (document.getElementById('mainHoseLength')) document.getElementById('mainHoseLength').value = comps.hoses.mainLength;
                        if (document.getElementById('cylinderHoseDiameter')) document.getElementById('cylinderHoseDiameter').value = comps.hoses.cylinderDiameter;
                        if (document.getElementById('cylinderHoseLength')) document.getElementById('cylinderHoseLength').value = comps.hoses.cylinderLength;
                    }

                    // Trigger cost update one last time
                    updateCylinderPricing();

                    // Force refresh accessories checkboxes
                    // (They are inside renderSelection output, we need to check them)
                    accessories.forEach((acc, idx) => {
                        const cb = document.getElementById(`acc_${idx}`);
                        if (cb) cb.checked = acc.included;
                    });
                    updateAccessoryStatus(0); // Trigger just to be sure

                }, 500);
            }
        }, 300);

        // Set Edit Mode
        isEditMode = true;
        originalProjectState = JSON.stringify({
            customerName: project.customer_name,
            inputs: project.inputs,
            components: project.components
        });

        const headerBtn = document.getElementById('headerSaveBtn');
        if (headerBtn) {
            headerBtn.innerHTML = '<i class="ri-refresh-line"></i> Projeyi Güncelle';
            headerBtn.disabled = true; // disabled until change
            headerBtn.classList.add('opacity-50', 'cursor-not-allowed');
        }

    } catch (e) {
        showStatusModal('Hata', 'Proje yüklenemedi: ' + e.message, 'error');
    }
}

// Store original state for dirty checking
// We need a clean object matching getFormData structure
// Store original state for dirty checking
// We need a clean object matching getFormData structure
const distinctState = {
    customerName: project.customerName,
    inputs: project.inputs || {},
    components: project.components || {}
};
originalProjectState = JSON.stringify(distinctState);

// Switch to Edit Mode
isEditMode = true;
const headerBtn = document.getElementById('headerSaveBtn');
if (headerBtn) {
    headerBtn.innerHTML = '<i class="ri-refresh-line"></i> Projeyi Güncelle';
    // Initially disable until changes
    headerBtn.disabled = true;
    headerBtn.classList.add('opacity-50', 'cursor-not-allowed');
}

// Switch view to Project Form
document.getElementById('projectsListSection').classList.add('hidden');
document.getElementById('projectSection').classList.remove('hidden');

// Update sidebar navigation active state - KEEP ON PROJECTS
document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
document.getElementById('openProjectsBtn').classList.add('active');

// Make Save/Update button visible explicitly since we are overriding the sidebar logic
if (headerBtn) headerBtn.style.display = 'inline-flex';

// Update Section Title and Inject Back Button
const cardHeader = document.querySelector('#projectSection .card-header h3');
if (cardHeader) {
    cardHeader.innerHTML = '<i class="ri-file-edit-line" style="margin-right: 8px;"></i>Proje Detayları';
}

// Attach listeners for dirty checking
const inputs = document.querySelectorAll('#elevatorForm input, #elevatorForm select, #selectionSection input, #selectionSection select');
inputs.forEach(input => {
    input.addEventListener('input', checkForChanges);
    input.addEventListener('change', checkForChanges);
});
// Special case for accessories since they are in a dynamic list, maybe add listener to container or re-attach
// For now assuming accessories are checkboxes inside these sections

// Also attach to accessory checkboxes which might be generated dynamically
// A mutation observer or delegating listener on body/container would be better but let's try direct attachement if they exist
// They are in 'accessoriesList' div usually.
// Better: Add global listener for change on inputs
document.getElementById('projectSection').addEventListener('input', checkForChanges);
document.getElementById('projectSection').addEventListener('change', checkForChanges);

// Scroll to top
const contentWrapper = document.querySelector('.content-wrapper');
if (contentWrapper) {
    contentWrapper.scrollTop = 0;
}

closeSidebar();
showStatusModal('Başarılı', `Proje ${projectNumber} yüklendi!`, 'success');
}

async function loadProjectsList(searchTerm = '', statusFilter = 'all') {
    const tbody = document.getElementById('projectsTableBody');
    if (!tbody) return; // Not on All Projects page

    tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4">Yükleniyor...</td></tr>';

    try {
        const projects = await db.projects.getAll();

        const filtered = projects.filter(p => {
            const matchesSearch = (
                p.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.project_number?.toLowerCase().includes(searchTerm.toLowerCase())
            );
            const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
            return matchesSearch && matchesStatus;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4">Kayıtlı proje bulunamadı.</td></tr>';
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            // Check status for badges
            let statusBadge = '<span class="badge badge-outline">Taslak</span>';
            if (p.status === 'production') statusBadge = '<span class="badge badge-primary">Üretimde</span>';
            if (p.status === 'shipped') statusBadge = '<span class="badge badge-success">Tamamlandı</span>';

            const dateStr = new Date(p.created_at).toLocaleDateString('tr-TR');
            const cylInfo = p.selected_cylinder ? p.selected_cylinder : '-';

            return `
                <tr>
                    <td><strong>${p.project_number}</strong></td>
                    <td>${p.customer_name}</td>
                    <td>${cylInfo}</td>
                    <td>${dateStr}</td>
                    <td>${statusBadge}</td>
                    <td>
                        <button class="btn btn-sm btn-outline-primary" onclick="loadProject('${p.project_number}')">
                            <i class="ri-edit-line"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="confirmDeleteProject('${p.project_number}')">
                            <i class="ri-delete-bin-line"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');

    } catch (e) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center p-4 text-danger">Hata: ${e.message}</td></tr>`;
    }
}

// Global variable for project to delete
let projectToDelete = null;

function confirmDeleteProject(projectNumber) {
    projectToDelete = projectNumber;
    // Show modal
    const modal = document.getElementById('deleteConfirmModal');
    if (modal) {
        document.getElementById('deleteProjectNumber').textContent = projectNumber;
        modal.classList.remove('hidden');
    } else {
        // Fallback
        if (confirm(`${projectNumber} numaralı projeyi silmek istediğinize emin misiniz?`)) {
            deleteProject(projectNumber);
        }
    }
}

async function deleteProject(projectNumber = null) {
    const target = projectNumber || projectToDelete;
    if (!target) return;

    try {
        await db.projects.delete(target);

        // Update UI logic
        if (projectNumber) {
            // Direct call (fallback)
            loadProjectsList();
        } else {
            // Modal call
            const modal = document.getElementById('deleteConfirmModal');
            if (modal) modal.classList.add('hidden');
            loadProjectsList();
            showStatusModal('Başarılı', 'Proje silindi.', 'success');
        }

        // If current project is the deleted one, reset form
        const currentProjectNum = document.getElementById('projectNumber')?.value;
        if (currentProjectNum === target) {
            resetToNewProject();
        }

    } catch (e) {
        showStatusModal('Hata', 'Silinirken hata oluştu: ' + e.message, 'error');
    }
    projectToDelete = null;
}

async function moveToProduction(projectNumber) {
    if (confirm(`${projectNumber} numaralı projeyi üretime almak istiyor musunuz?`)) {
        try {
            // We need to find the project ID first usually, but our DB wrapper might handle searching by project_number
            // if we didn't implement that in db.js, we have to fetch list or implement getByProjectNumber.
            // db.js has projects.getAll(). Let's fetch all and find ID.
            // Efficient way: db.js assumes we might pass ID for updates?
            // checking db.js... db.projects.update(id, updates).
            // So we need unique ID. 
            // Let's assume we fetch all and find it.
            const projects = await db.projects.getAll();
            const project = projects.find(p => p.project_number === projectNumber);

            if (!project) {
                showStatusModal('Hata', 'Proje veritabanında bulunamadı!', 'error');
                return;
            }

            await db.projects.update(project.id, {
                status: 'production',
                production_stage: 'imalat'
            });

            showStatusModal('Başarılı', `Proje ${projectNumber} üretime alındı!`, 'success');
            loadProjectsList();
        } catch (e) {
            showStatusModal('Hata', 'İşlem başarısız: ' + e.message, 'error');
        }
    }
}

let currentSortOrder = 'desc'; // 'desc' (newest first) or 'asc' (oldest first)
let currentSearchTerm = '';
let currentStatusFilter = 'all';

function toggleDateSort() {
    currentSortOrder = currentSortOrder === 'desc' ? 'asc' : 'desc';

    // Update Icon
    const icon = document.getElementById('dateSortIcon');
    if (icon) {
        icon.className = currentSortOrder === 'desc' ? 'ri-sort-desc' : 'ri-sort-asc';
    }

    loadProjectsList();
}

function filterProjects(status) {
    currentStatusFilter = status;
    loadProjectsList();
}

function searchProjects() {
    const input = document.getElementById('projectSearchInput');
    if (input) {
        currentSearchTerm = input.value.trim();
        loadProjectsList();
    }
}

async function cancelProduction(projectNumber) {
    try {
        const projects = await db.projects.getAll();
        const project = projects.find(p => p.project_number === projectNumber);

        if (!project) {
            showStatusModal('Hata', 'Proje bulunamadı!', 'error');
            return;
        }

        await db.projects.update(project.id, {
            status: 'draft',
            production_stage: null
        });

        showSuccessModal(`Proje ${projectNumber} üretimi iptal edildi, taslak olarak kaydedildi.`);
        loadProjectsList();
    } catch (e) {
        showStatusModal('Hata', 'İptal işlemi başarısız: ' + e.message, 'error');
    }
}

function openSidebar() {
    // No-op for now, or implement mobile toggle
    console.log('Sidebar toggle requested');
}

function closeSidebar() {
    // No-op
}

// Export/Import Functions
// Export/Import Functions Removed

// Export/Import and Google Sheets functions removed

// Export/Import and Google Sheets functions removed

const calculateBtn = document.getElementById('calculateBtn');
if (calculateBtn) {
    calculateBtn.addEventListener('click', calculate);
}

// Fixed: Only add listener if element exists and not conflicting with sidebar actions
const openProdBtnTemp = document.getElementById('openProductionBtn');
// Note: There is another listener for this below, removing this one or ensuring it only redirects if needed.
// Actually, in the new structure, openProductionBtn is a link on some pages, but if it is a button, we want it to work.
// Since we are moving to multi-page, having it separate is fine.
if (openProdBtnTemp && openProdBtnTemp.tagName === 'BUTTON') {
    // If it is a button, we might want to redirect.
    // But wait, line 2276 does showSection.
    // Let's comment this one out as it conflicts or just make it safe.
    // If we are on index.html, we want showSection (or maybe redirect since we are splitting pages).
    // The user request implies splitting pages. "index.html" vs "all-projects.html".
    // production.html is already a separate page.
    // So clicking "Üretim Takibi" should probably go to 'production.html'.
    openProdBtnTemp.addEventListener('click', () => {
        window.location.href = 'production.html';
    });
}


function calculate() {
    // 1. Get Inputs
    const capacity = parseFloat(document.getElementById('capacity').value);
    const carcassWeight = parseFloat(document.getElementById('carcassWeight').value);
    const travelDistance = parseFloat(document.getElementById('travelDistance').value);
    const buffer = parseFloat(document.getElementById('buffer').value);
    const speed = parseFloat(document.getElementById('speed').value);
    const suspension = document.getElementById('suspension').value;
    const cylinderCount = parseInt(document.getElementById('cylinderCount').value);
    const regulation = document.getElementById('regulation').value;

    // Validation
    if (isNaN(capacity) || isNaN(carcassWeight) || isNaN(travelDistance) || isNaN(speed) || isNaN(buffer)) {
        showStatusModal('Eksik Bilgi', "Lütfen tüm alanları doldurunuz.", 'warning');
        return;
    }

    // 2. Constants & Derived Values
    // Buffer is already read above
    let stroke; // H13
    if (suspension === '1:1') {
        stroke = travelDistance + buffer;
    } else {
        stroke = (travelDistance + buffer) / 2;
    }

    const extraWeight = 100; // C11
    const gravity = 9.81;

    // 3. Iterate Cylinders
    const results = [];

    cylinderSizes.forEach(cyl => {
        const D = cyl.d; // H21
        const t = cyl.t; // H22

        // Skip invalid thickness
        if (t <= 0) return;

        // Calculate Ram Weight (C10)
        // Formula: (((H21-H22)*H22)/40.55)*H13/1000
        const ramWeight = (((D - t) * t) / 40.55) * (stroke / 1000);

        // Calculate Area (mm^2)
        // Formula: POWER(H21,2)*3.14*0.25
        const area = Math.pow(D, 2) * 3.14 * 0.25;

        // Calculate Forces (kg)
        // Force = (Weight * Factor / Cylinders) + RamWeight + Extra
        // Factor: 2 for 2:1 (Wait, formula was C9*2/C12).
        // If 2:1, Weight is multiplied by 2?
        // Let's re-read formula: IF(C13='2:1', ((C9*2/C12)+...), ...)
        // Yes, for 2:1, the weight term is Weight * 2 / Cylinders.
        // For 1:1, the weight term is Weight * 1 / Cylinders.

        const suspensionFactor = (suspension === '2:1') ? 2 : 1;

        const emptyWeightTerm = (carcassWeight * suspensionFactor) / cylinderCount;
        const fullWeightTerm = ((capacity + carcassWeight) * suspensionFactor) / cylinderCount;

        const forceEmpty = emptyWeightTerm + ramWeight + extraWeight;
        const forceFull = fullWeightTerm + ramWeight + extraWeight;

        // Calculate Pressures (Bar)
        // Pressure = Force * 9.81 * 10 / Area
        const pressureEmpty = (forceEmpty * gravity * 10) / area;
        const pressureFull = (forceFull * gravity * 10) / area;

        // --- Buckling Calculation ---
        // 1. Slenderness Ratio (Lambda)
        const d_inner = D - 2 * t;
        const inertia = (Math.PI * (Math.pow(D, 4) - Math.pow(d_inner, 4))) / 64;
        const radiusOfGyration = Math.sqrt(inertia / area);
        const lambda = stroke / radiusOfGyration;

        // 2. Critical Force (F_crit) - H29
        const E = 210000; // Elasticity Modulus
        const Rp02 = 355; // Yield Strength
        let f_crit;

        if (lambda >= 100) {
            // Euler Case
            // Formula: (PI^2 * E * I) / (2 * L^2)
            f_crit = (Math.pow(Math.PI, 2) * E * inertia) / (2 * Math.pow(stroke, 2));
        } else {
            // Tetmajer/Plastic Case
            // Formula: (Area / 2) * (Rp02 - (Rp02 - 210) * (Lambda / 100)^2)
            f_crit = (area / 2) * (Rp02 - (Rp02 - 210) * Math.pow(lambda / 100, 2));
        }

        // 3. Acting Buckling Force (F_acting) - H30
        // Formula: 1.4 * 9.81 * (LoadTerm + 0.64 * (RamWeight + Extra))
        // LoadTerm is full load (Capacity + Carcass)
        // Note: In H30 formula: 2 * ((C9+C8)/C12) for 2:1. 
        // My fullWeightTerm is ((C9+C8) * 2) / C12. It matches.

        const ramTotalWeight = ramWeight + extraWeight;
        const f_acting = 1.4 * 9.81 * (fullWeightTerm + 0.64 * ramTotalWeight);

        // 4. Buckling Check
        const isBucklingSafe = f_crit >= f_acting;
        const utilization = (f_acting / f_crit) * 100;

        // Check Constraints
        // Empty >= 12, Full <= 59, Buckling Safe
        const isValid = pressureEmpty >= 12 && pressureFull <= 59 && isBucklingSafe;

        results.push({
            type: `${D}x${t}`,
            d: D,
            t: t,
            pressureEmpty: pressureEmpty.toFixed(1),
            pressureFull: pressureFull.toFixed(1),
            bucklingSafe: isBucklingSafe,
            lambda: lambda.toFixed(1),
            f_crit: f_crit.toFixed(0),
            f_acting: f_acting.toFixed(0),
            utilization: utilization.toFixed(1),
            valid: isValid
        });
    });

    // 4. Render Results
    calculatedResults = results;
    renderResults(results);
}

function renderResults(results, skipScroll = false) {
    const tbody = document.querySelector('#cylinderTable tbody');
    tbody.innerHTML = '';

    // Filter to show only valid cylinders
    const validResults = results.filter(res => res.valid);

    // If no valid results, show a message
    if (validResults.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="11" style="text-align: center; padding: 20px; color: #f87171;">
                    Girilen parametreler için uygun silindir bulunamadı. Lütfen parametreleri kontrol edin.
                </td>
            </tr>
        `;
        document.getElementById('resultsSection').classList.remove('hidden');
        return;
    }

    // Sort: by diameter
    validResults.sort((a, b) => a.d - b.d);

    validResults.forEach(res => {
        const tr = document.createElement('tr');
        const statusClass = res.valid ? 'badge-success' : 'badge-danger';
        const statusText = res.valid ? 'Uygun' : 'Uygun Değil';
        const bucklingClass = res.bucklingSafe ? 'badge-success' : 'badge-danger';
        const bucklingText = res.bucklingSafe ? 'OK' : 'Riskli';

        const utilVal = parseFloat(res.utilization);
        let utilColor = 'var(--danger)';
        if (utilVal > 50) utilColor = 'var(--warning)';
        if (utilVal > 80) utilColor = 'var(--success)';

        const utilBar = `
            <div class="progress-bar">
                <div class="progress-fill" style="width: ${Math.min(utilVal, 100)}%; background-color: ${utilColor};"></div>
            </div>
            <div class="progress-text" style="color: black;">%${res.utilization}</div>
        `;

        tr.innerHTML = `
            <td><strong>${res.type}</strong></td>
            <td>${res.d}</td>
            <td>${res.t}</td>
            <td>${res.pressureEmpty}</td>
            <td>${res.pressureFull}</td>
            <td>${res.f_crit}</td>
            <td>${res.f_acting}</td>
            <td>${utilBar}</td>
            <td><span class="badge ${bucklingClass}">${bucklingText}</span></td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
            <td>
                <button class="btn btn-primary btn-sm" onclick="selectCylinder('${res.type}')">Seç</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('resultsSection').classList.remove('hidden');

    // Scroll to results
    if (!skipScroll) {
        document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
    }
}

// Global variable to keep track of selected cylinder type
let selectedCylinder = null;

function selectCylinder(type, skipScroll = false) {
    // Store selected cylinder type for saving
    selectedCylinder = type;

    // Enable header save button
    const headerSaveBtn = document.getElementById('headerSaveBtn');
    if (headerSaveBtn) headerSaveBtn.disabled = false;

    const result = calculatedResults.find(r => r.type === type);
    if (!result) return;

    // Get Inputs again for calculation
    const speed = parseFloat(document.getElementById('speed').value);
    const cylinderCount = parseInt(document.getElementById('cylinderCount').value);
    const suspension = document.getElementById('suspension').value;
    const suspensionFactor = (suspension === '2:1') ? 2 : 1;

    // 1. Calculate Required Flow (L/min)
    // Formula: Speed (m/s) * Area (mm2) * 60 / 1000 * Cylinders / Factor
    // Area = PI * D^2 / 4
    const area = Math.pow(result.d, 2) * Math.PI * 0.25;
    const q_req = (speed * area * 60 * cylinderCount) / (suspensionFactor * 1000);

    // 2. Select Pump
    // Find first pump with flow >= q_req
    // Actually, Excel uses VLOOKUP with TRUE (approximate match) or FALSE?
    // Excel formula was VLOOKUP(..., FALSE), but it looked up the *Calculated Flow*?
    // No, it looked up C34 (Actual Flow). 
    // Let's assume we pick the closest larger pump.
    let selectedPump = pumps.find(p => p.flow >= q_req);
    if (!selectedPump) selectedPump = pumps[pumps.length - 1]; // Max pump if none found

    const q_actual = selectedPump.flow;

    // 3. Calculate Effective Speed
    // Speed = Q * Factor * 1000 / (Area * 60 * Cylinders)
    const speed_eff = (q_actual * suspensionFactor * 1000) / (area * 60 * cylinderCount);

    // 4. Calculate Required Power (kW)
    // Formula: Q (L/min) * MaxPressure (Bar) * 1.3 / 600
    // MaxPressure is result.pressureFull (Dynamic pressure usually higher, but let's use Full Pressure for now or add margin)
    // Excel used H26 (Max Dynamic Pressure).
    // H26 = H25 (Max Static) + L46 (Pressure Drop).
    // Let's use result.pressureFull * 1.15 (approx dynamic factor) or just use pressureFull for estimation.
    // Excel: C36 = C34 * H26 * 1.3 / 600.
    // Let's use pressureFull as a base.
    const p_req = (q_actual * parseFloat(result.pressureFull) * 1.3) / 600;

    // 5. Select Motor
    let selectedMotor = motors.find(m => m.kw >= p_req);
    if (!selectedMotor) selectedMotor = motors[motors.length - 1];

    // 6. Valve Selection
    // Determine Main Valve Options based on Pump Flow (q_actual)
    // q_actual is already defined above
    let recommendedMainValve = "";

    // Define all possible main valves for the dropdown
    // We will mark the recommended one.

    if (q_actual <= 75) {
        // Range 0-75: Default to 0,75'' EV100
        recommendedMainValve = "0,75'' EV100";
    } else if (q_actual <= 122) {
        recommendedMainValve = "0,75'' EV100";
    } else if (q_actual <= 400) {
        recommendedMainValve = "1,5'' EV100";
    } else {
        recommendedMainValve = "1,5'' EV100";
    }

    // Determine Rupture Valve Size (R10)
    // Using previous logic based on max flow per cylinder
    const maxSpeed = speed + 0.3;
    const maxFlowPerCylinder = (maxSpeed * area * 60) / (suspensionFactor * 1000);

    let ruptureSize = "Aralık Dışında";
    if (maxFlowPerCylinder <= 55) ruptureSize = "0.5\"";
    else if (maxFlowPerCylinder <= 100) ruptureSize = "0.75\"";
    else if (maxFlowPerCylinder <= 165) ruptureSize = "1.0\"";
    else if (maxFlowPerCylinder <= 400) ruptureSize = "1.5\"";
    else if (maxFlowPerCylinder <= 1200) ruptureSize = "2.0\"";

    // Format valve name to match burstHoseValves
    const needsDK = cylinderCount >= 2;
    let recommendedValveObj = burstHoseValves.find(v => v.size === ruptureSize && v.hasDK === needsDK);

    // Fallback: If 0.5" needed but no DK version exists (common case), upgrade to 0.75" DK
    if (!recommendedValveObj && needsDK && ruptureSize === "0.5\"") {
        recommendedValveObj = burstHoseValves.find(v => v.size === "0.75\"" && v.hasDK === true);
    }

    let recommendedRuptureValve = recommendedValveObj ? recommendedValveObj.name : "Yok";

    // 7. Calculate Required Oil Volume
    // Approximate: Oil volume ≈ (D^2 * π / 4) * stroke * cylinders / 1000 * 1.5
    const travelDistance = parseFloat(document.getElementById('travelDistance').value);
    const stroke = travelDistance / 1000; // Convert mm to meters
    const cylinderVolume = (Math.pow(result.d, 2) * Math.PI * 0.25 * stroke * cylinderCount) / 1000; // Liters
    const requiredOilVolume = cylinderVolume * 1.5; // Add 50% for safety/reserve

    // 8. Power Unit Selection
    // Find suitable power units based ONLY on tank capacity
    const pumpFlow = selectedPump.flow;
    const motorPower = selectedMotor.kw;

    const suitablePowerUnits = powerUnits.filter(unit => {
        return unit.tankCapacity >= requiredOilVolume; // Only check tank capacity
    });

    // Recommend the first suitable unit (smallest)
    const recommendedPowerUnit = suitablePowerUnits.length > 0 ? suitablePowerUnits[0].model : "Uygun Ünite Bulunamadı";

    // Render Selection with Dropdowns
    renderSelection(result, q_req, selectedPump, speed_eff, p_req, selectedMotor, recommendedRuptureValve, recommendedMainValve, recommendedPowerUnit, suitablePowerUnits, requiredOilVolume, pumpFlow, motorPower, skipScroll);
}

function renderSelection(cylinder, q_req, recommendedPump, speed_eff, p_req, recommendedMotor, recommendedRuptureValve, recommendedMainValve, recommendedPowerUnit, suitablePowerUnits, requiredOilVolume, pumpFlow, motorPower, skipScroll = false) {
    const selectionDiv = document.getElementById('selectionSection');
    if (!selectionDiv) {
        const contentWrapper = document.querySelector('.content-wrapper');
        const section = document.createElement('section');
        section.id = 'selectionSection';
        section.className = 'content-section hidden';
        // Initial empty structure, will be filled below
        contentWrapper.appendChild(section);
    }

    // Generate Options for Pump
    const pumpOptions = pumps.map(p => {
        const isSelected = p.name === recommendedPump.name ? 'selected' : '';
        const isRecommended = p.name === recommendedPump.name ? ' (Önerilen)' : '';
        return `<option value="${p.name}" ${isSelected}>${p.name} - ${p.flow} L/min${isRecommended}</option>`;
    }).join('');

    // Generate Options for Motor
    const motorOptions = motors.map(m => {
        const isSelected = m.name === recommendedMotor.name ? 'selected' : '';
        const isRecommended = m.name === recommendedMotor.name ? ' (Önerilen)' : '';
        const isSufficient = m.kw >= p_req;
        const style = isSufficient ? '' : 'color: #f87171;';
        const warning = isSufficient ? '' : ' (Yetersiz Güç)';
        return `<option value="${m.name}" style="${style}" ${isSelected}>${m.name} - ${m.kw} kW${isRecommended}${warning}</option>`;
    }).join('');

    // Generate Options for Rupture Valve (R10)
    // Fallback data definition to ensure dropdown populates
    const burstHoseValvesList = [
        { size: '0.5"', name: "0,5'' R10L A-0,5'' G / T A-0,5'' G", hasDK: false, price: 116.52 },
        { size: '0.75"', name: "0,75'' R10L A-0,75'' G / T A-0,75'' G", hasDK: false, price: 129.99 },
        { size: '0.75"', name: "0,75'' R10L A-0,75'' G / T A-0,75'' G + DK", hasDK: true, price: 129.99 },
        { size: '1.0"', name: "1,0'' R10L A-1,0'' G / T A-1,0'' G", hasDK: false, price: 129.99 },
        { size: '1.0"', name: "1,0'' R10L A-1,0'' G / T A-1,0'' G + DK", hasDK: true, price: 143.98 },
        { size: '1.5"', name: "1,5'' R10L A-1,5'' G / T A-1,5'' G", hasDK: false, price: 158.02 },
        { size: '1.5"', name: "1,5'' R10L A-1,5'' G / T A-1,5'' G + DK", hasDK: true, price: 172.00 },
        { size: '2.0"', name: "2,0'' R10L A-2,0'' G / T A-2,0'' G", hasDK: false, price: 212.86 },
        { size: '2.0"', name: "2,0'' R10L A-2,0'' G / T A-2,0'' G + DK", hasDK: true, price: 226.86 }
    ];
    console.log('Burst Hose Valves List Length:', burstHoseValvesList.length);
    // alert('Rupture Valves Loaded: ' + burstHoseValvesList.length); // Debug alert

    let ruptureOptions = '<option value="Yok">Yok (İstemiyorum)</option>';
    ruptureOptions += burstHoseValvesList.map(v => {
        const isSelected = v.name === recommendedRuptureValve ? 'selected' : '';
        const isRecommended = v.name === recommendedRuptureValve ? ' (Önerilen)' : '';
        return `<option value="${v.name}" ${isSelected}>${v.name}${isRecommended}</option>`;
    }).join('');

    // Generate Options for Main Valve
    const allMainValves = [
        "0,5'' GV", "0,5'' KV1P", "0,5'' KV1S", "0,5'' KV2P", "0,5'' KV2S",
        "0,75'' EVD", "0,75'' EV100", "1,5'' EV100"
    ];

    const mainValveOptions = allMainValves.map(val => {
        const isSelected = val === recommendedMainValve ? 'selected' : '';
        const isRecommended = val === recommendedMainValve ? ' (Önerilen)' : '';
        return `<option value="${val}" ${isSelected}>${val}${isRecommended}</option>`;
    }).join('');

    // Generate Options for Power Unit
    const powerUnitOptions = powerUnits.map(unit => {
        const tankOk = unit.tankCapacity >= requiredOilVolume;
        const isSuitable = tankOk;
        const isSelected = unit.model === recommendedPowerUnit ? 'selected' : '';
        const isRecommended = unit.model === recommendedPowerUnit ? ' (Önerilen)' : '';
        const suitableText = isSuitable && unit.model !== recommendedPowerUnit ? ' ✓' : '';
        const unsuitable = !tankOk ? ' ⚠️ Yetersiz Tank' : '';
        const tankInfo = ` [${unit.tankCapacity}L]`;
        return `<option value="${unit.model}" ${isSelected}>${unit.model}${tankInfo}${isRecommended}${suitableText}${unsuitable}</option>`;
    }).join('');

    // Voltage Options
    const voltageOptions = `
            <option value="380">380V Üçgen / Yıldız</option>
                ${recommendedMotor.current220 ? '<option value="220">220V Üçgen</option>' : ''}
        `;

    // Motor Details
    const vVal = 400;
    const nominalCurrent = (1.5 * recommendedMotor.kw * 1000) / (1.732 * vVal * 0.79);
    let starCurrent = 0;
    let deltaCurrent = 0;
    if (recommendedMotor.current380) {
        starCurrent = recommendedMotor.current380.star;
        deltaCurrent = recommendedMotor.current380.delta;
    }

    const cylinderCount = parseInt(document.getElementById('cylinderCount').value) || 2;
    const speed = parseFloat(document.getElementById('speed').value);

    // Build the new Dashboard HTML
    const section = document.getElementById('selectionSection');
    section.innerHTML = `
            <div class="selection-dashboard">
            <!--1. Summary Bar-->
            <div class="selection-summary-bar">
                <div class="summary-metric">
                    <span class="label">Seçilen Silindir</span>
                    <span class="value">${cylinder.type}</span>
                    <span class="sub-value">${cylinderCount} adet</span>
                </div>
                <div class="summary-metric">
                    <span class="label">Efektif Hız</span>
                    <span class="value" id="effectiveSpeedDisplay">${speed_eff.toFixed(3)} m/s</span>
                    <span class="sub-value">Hedef: ${speed} m/s</span>
                </div>
                <div class="summary-metric">
                    <span class="label">Tahmini Maliyet</span>
                    <span class="value" id="topTotalCost">- €</span>
                    <span class="sub-value">KDV Hariç</span>
                </div>
            </div>

            <!-- 2. System Components (Full Width) -->
            <div class="component-panel mb-6">
                <div class="panel-header">
                    <h3><i class="ri-settings-3-line"></i> Sistem Bileşenleri</h3>
                </div>
                <div class="panel-body">
                    <!-- Two-Piece Cylinder Option -->
                    <!-- Two-Piece Cylinder Option -->
                    <div class="feature-card" onclick="document.getElementById('twoPieceCylinder').click()">
                        <div class="feature-info">
                            <div class="feature-icon">
                                <i class="ri-stack-line"></i>
                            </div>
                            <div class="feature-text">
                                <h4 class="feature-title">İki Parça Silindir</h4>
                                <p class="feature-desc">Uzun stroklar için ekli silindir kullanımı</p>
                            </div>
                        </div>
                        <div class="feature-action">
                            <label class="switch" onclick="event.stopPropagation()">
                                <input type="checkbox" id="twoPieceCylinder" onchange="updateCylinderPricing(); updateFeatureCard(this)">
                                <span class="slider round"></span>
                            </label>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <!-- Pump Section -->
                        <div class="component-group">
                            <div class="group-title"><i class="ri-drop-line"></i> Pompa Seçimi</div>
                            <div class="grid gap-4">
                                <div class="input-group">
                                    <label>Pompa Modeli</label>
                                    <select id="pumpSelect" class="compact-select" onchange="updateCalculations('${cylinder.type}')">
                                        ${pumpOptions}
                                    </select>
                                </div>
                                <div class="flex items-center justify-between text-sm px-3 py-2 bg-slate-50 rounded border border-slate-100">
                                    <span class="text-muted">Hesaplanan Debi:</span>
                                    <span class="font-semibold text-primary">${q_req.toFixed(1)} L/min</span>
                                </div>
                            </div>
                        </div>

                        <!-- Motor Section -->
                        <div class="component-group">
                            <div class="group-title"><i class="ri-flashlight-line"></i> Motor Seçimi</div>
                            <div class="grid gap-4">
                                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div class="input-group">
                                        <label>Motor Gücü</label>
                                        <select id="motorSelect" class="compact-select" onchange="updateMotorDetails()">
                                            ${motorOptions}
                                        </select>
                                    </div>
                                    <div class="input-group">
                                        <label>Voltaj</label>
                                        <select id="voltageSelect" class="compact-select" onchange="updateMotorDetails()">
                                            ${voltageOptions}
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- Motor Specs Table -->
                                <div id="motorDetails" class="motor-specs-container">
                                    <div class="spec-row" style="background-color: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.2);">
                                        <span class="spec-label" style="color: var(--primary); font-weight: 700;">Gerekli Güç</span>
                                        <span class="spec-value" id="reqPowerDisplay" style="color: var(--primary); font-weight: 700;">${p_req.toFixed(1)} kW</span>
                                    </div>
                                    <div class="spec-row">
                                        <span class="spec-label">Model</span>
                                        <span class="spec-value" id="motorModelDisplay">${recommendedMotor.name}</span>
                                    </div>
                                    <div class="spec-row">
                                        <span class="spec-label">Seçilen Güç</span>
                                        <span class="spec-value" id="motorPowerDisplay">${recommendedMotor.kw} kW</span>
                                    </div>
                                    <div class="spec-row">
                                        <span class="spec-label">Nominal Akım</span>
                                        <span class="spec-value text-warning" id="motorNominalDisplay">${nominalCurrent.toFixed(1)} A</span>
                                    </div>
                                    <div class="spec-row">
                                        <span class="spec-label">Yıldız Akım</span>
                                        <span class="spec-value text-warning" id="motorStarDisplay">${starCurrent} A</span>
                                    </div>
                                    <div class="spec-row">
                                        <span class="spec-label">Üçgen Akım</span>
                                        <span class="spec-value text-warning" id="motorDeltaDisplay">${deltaCurrent} A</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Valves Group -->
                        <div class="component-group">
                            <div class="group-title"><i class="ri-equalizer-line"></i> Valf Grubu</div>
                            <div class="grid gap-4">
                                <div class="input-group">
                                    <label>Patlak Hortum Valfi</label>
                                    <select id="ruptureSelect" class="compact-select" onchange="updateCylinderPricing()">
                                        ${ruptureOptions}
                                    </select>
                                </div>
                                <div class="input-group">
                                    <label>Ana Kontrol Valfi</label>
                                    <select id="mainValveSelect" class="compact-select" onchange="updateCylinderPricing()">
                                        ${mainValveOptions}
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- 3. Power Unit & Hoses (Side-by-Side) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <!-- Power Unit Card -->
                <div class="tech-card h-full">
                    <div class="panel-header">
                        <h3><i class="ri-server-line"></i> Güç Ünitesi</h3>
                    </div>
                    <div class="panel-body">
                        <div class="input-group mb-3">
                            <select id="powerUnitSelect" class="compact-select" onchange="updatePowerUnitInfo()">
                                ${powerUnitOptions}
                            </select>
                        </div>
                        <hr style="margin: 0.75rem 0 0 0; border: 0; border-top: 1px solid var(--border-color);">
                        <div class="tech-list" id="powerUnitInfo">
                            <div class="tech-item">
                                <span class="label">Gerekli Yağ</span>
                                <span class="value text-warning">${requiredOilVolume.toFixed(1)} L</span>
                            </div>
                            <div class="tech-item">
                                <span class="label">Toplam Yağ</span>
                                <span class="value text-success" id="totalOilDisplay">${powerUnits.find(u => u.model === recommendedPowerUnit)?.totalOil?.toFixed(1) || '-'} L</span>
                            </div>
                            <div class="tech-item">
                                <span class="label">Ölü Bölge</span>
                                <span class="value text-muted" id="deadZoneDisplay">${powerUnits.find(u => u.model === recommendedPowerUnit)?.deadZone || '-'} L</span>
                            </div>
                            <div class="tech-item">
                                <span class="label">Boyutlar</span>
                                <span class="value text-muted" id="dimensionsDisplay">${powerUnits.find(u => u.model === recommendedPowerUnit)?.length || '-'} × ${powerUnits.find(u => u.model === recommendedPowerUnit)?.width || '-'} × ${powerUnits.find(u => u.model === recommendedPowerUnit)?.height || '-'} mm</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Hoses -->
                <div class="component-panel">
                    <div class="panel-header">
                        <h3><i class="ri-links-line"></i> Hortum Konfigürasyonu</h3>
                    </div>
                    <div class="panel-body">
                        <div class="hose-grid">
                            <!-- Main Hose -->
                            <div class="hose-config-item">
                                <h4 class="text-sm font-semibold">Ana Hortum</h4>
                                <div class="input-group">
                                    <label>Çap</label>
                                    <select id="mainHoseDiameter" class="compact-select" onchange="updateHoseCost()">
                                        ${Object.keys(hosePricing).map(diameter => {
        const recommended = diameter === recommendHoseDiameter(pumpFlow);
        return `<option value="${diameter}" ${recommended ? 'selected' : ''}>${diameter}${recommended ? ' (Önerilen)' : ''}</option>`;
    }).join('')}
                                    </select>
                                </div>
                                <div class="input-group">
                                    <label>Uzunluk (m)</label>
                                    <input type="number" id="mainHoseLength" value="5" min="1" max="50" step="0.5" class="compact-select" onchange="updateHoseCost()">
                                </div>
                            </div>

                            <!-- Cylinder Hose (only shown if cylinderCount > 1) -->
                            ${cylinderCount > 1 ? `
                            <div class="hose-config-item">
                                <h4 class="text-sm font-semibold">Silindir Hortumu (x${cylinderCount})</h4>
                                <div class="input-group">
                                    <label>Çap</label>
                                    <select id="cylinderHoseDiameter" class="compact-select" onchange="updateHoseCost()">
                                        ${Object.keys(hosePricing).map(diameter => {
        const recommended = diameter === recommendHoseDiameter(pumpFlow / cylinderCount);
        return `<option value="${diameter}" ${recommended ? 'selected' : ''}>${diameter}${recommended ? ' (Önerilen)' : ''}</option>`;
    }).join('')}
                                    </select>
                                </div>
                                <div class="input-group">
                                    <label>Uzunluk (m)</label>
                                    <input type="number" id="cylinderHoseLength" value="5" min="0.5" max="20" step="0.5" class="compact-select" onchange="updateHoseCost()">
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 4. Accessories -->
            <div class="component-panel mb-6">
                <div class="panel-header">
                    <h3><i class="ri-plug-line"></i> Aksesuarlar</h3>
                    <span id="accessoryCostDisplay" class="text-primary font-bold" style="font-size: 1.1rem; margin-left: auto;">0 €</span>
                </div>
                <div class="panel-body">
                    <div class="accessories-grid">
                        ${accessories.map((acc, index) => `
                            <div class="accessory-item">
                                <input type="checkbox" id="acc_${index}" ${acc.included ? 'checked' : ''} 
                                       onchange="updateAccessoryStatus(${index})">
                                <label for="acc_${index}">
                                    ${acc.name}
                                    <span class="category">${acc.category}</span>
                                </label>
                                <span id="acc_status_${index}" class="status-badge ${acc.included ? 'success' : 'error'}" style="display:none;">
                                    ${acc.included ? 'Dahil' : 'Dahil Değildir'}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>

            <!-- 5. Cost Summary Footer -->
            <div class="component-panel">
                <div class="panel-header">
                    <h3><i class="ri-money-euro-circle-line"></i> Maliyet Detayları</h3>
                    <span class="text-2xl font-bold text-success" id="totalCost" style="font-size: 1.5rem;">- €</span>
                </div>
                <div class="panel-body">
                    <div id="costBreakdown" class="grid grid-cols-2 md:grid-cols-4 gap-4" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
                        <!-- Breakdown items -->
                    </div>
                </div>
            </div>
            
            </div>
        </div>
            `;

    document.getElementById('selectionSection').classList.remove('hidden');
    if (!skipScroll) {
        document.getElementById('selectionSection').scrollIntoView({ behavior: 'smooth' });
    }

    // Calculate and display costs
    const buildingType = parseInt(document.getElementById('buildingType').value);
    const travelDistance = parseFloat(document.getElementById('travelDistance').value);

    // Calculate stroke in meters
    const suspension = document.getElementById('suspension').value;
    const buffer = parseFloat(document.getElementById('buffer').value) || 300;
    const strokeMM = suspension === '1:1' ? (travelDistance + buffer) : (travelDistance + buffer) / 2;
    const strokeMeters = strokeMM / 1000;

    // Prepare cost components
    const isTwoPiece = document.getElementById('twoPieceCylinder')?.checked || false;

    // Get hose configuration with fallbacks
    const mainHoseDiameter = document.getElementById('mainHoseDiameter')?.value || (typeof recommendHoseDiameter === 'function' ? recommendHoseDiameter(pumpFlow) : "3/4\"");
    const mainHoseLength = parseFloat(document.getElementById('mainHoseLength')?.value) || 5;
    const cylinderHoseDiameter = document.getElementById('cylinderHoseDiameter')?.value || (typeof recommendHoseDiameter === 'function' ? recommendHoseDiameter(pumpFlow / parseInt(document.getElementById('cylinderCount').value)) : "1/2\"");
    const cylinderHoseLength = parseFloat(document.getElementById('cylinderHoseLength')?.value) || 5;

    const costComponents = {
        cylinder: {
            cylinderType: cylinder.type,
            strokeMeters: strokeMeters,
            quantity: parseInt(document.getElementById('cylinderCount').value),
            isTwoPiece: isTwoPiece
        },
        motorName: recommendedMotor.name,
        pumpName: recommendedPump.name,
        powerUnitName: recommendedPowerUnit,
        ruptureValveName: recommendedRuptureValve,
        mainValveName: recommendedMainValve,
        hoses: {
            mainDiameter: mainHoseDiameter,
            mainLength: mainHoseLength,
            cylinderDiameter: cylinderHoseDiameter,
            cylinderLength: cylinderHoseLength,
            cylinderCount: parseInt(document.getElementById('cylinderCount').value)
        },
        accessories: accessories.filter(a => a.included).map(a => a.name)
    };

    const { totalCost, breakdown } = calculateSystemCost(costComponents);

    // Initial Cost Display
    document.getElementById('totalCost').textContent = `${totalCost.toFixed(0)} €`;
    if (document.getElementById('topTotalCost')) {
        document.getElementById('topTotalCost').textContent = `${totalCost.toFixed(0)} €`;
    }

    // Initial Hose Cost
    setTimeout(() => updateHoseCost(), 150);

    // Update rupture valve options based on cylinder count
    setTimeout(() => updateRuptureValveOptions(), 100);

    // Trigger updateCylinderPricing to populate breakdown
    setTimeout(() => updateCylinderPricing(), 200);



    // Inject Scroll to Top Button
    if (!document.getElementById('scrollTopBtn')) {
        const scrollBtn = document.createElement('button');
        scrollBtn.id = 'scrollTopBtn';
        scrollBtn.innerHTML = '<i class="ri-arrow-up-line"></i>';
        scrollBtn.onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
        document.body.appendChild(scrollBtn);

        // Scroll listener
        window.addEventListener('scroll', () => {
            if (window.scrollY > 300) {
                scrollBtn.classList.add('visible');
            } else {
                scrollBtn.classList.remove('visible');
            }
        });
    }
}
function updateCylinderPricing() {
    // Recalculate costs when two-piece cylinder checkbox changes
    const isTwoPiece = document.getElementById('twoPieceCylinder')?.checked || false;

    // Get current values
    const travelDistance = parseFloat(document.getElementById('travelDistance').value);
    const buffer = parseFloat(document.getElementById('buffer').value) || 300;
    const suspension = document.getElementById('suspension').value;
    const inputCylinderCount = parseInt(document.getElementById('cylinderCount').value);

    // Calculate stroke
    const strokeMM = suspension === '1:1' ? (travelDistance + buffer) : (travelDistance + buffer) / 2;
    const strokeMeters = strokeMM / 1000;

    // Get selected cylinder type from results
    const cylinderType = selectedCylinder; // This is set when user selects a cylinder

    if (!cylinderType) return;

    // Get other components
    const motorName = document.getElementById('motorSelect')?.value;
    const pumpName = document.getElementById('pumpSelect')?.value;
    const powerUnitName = document.getElementById('powerUnitSelect')?.value;

    // Get hose configuration
    const mainHoseDiameter = document.getElementById('mainHoseDiameter')?.value;
    const mainHoseLength = parseFloat(document.getElementById('mainHoseLength')?.value) || 5;
    const cylinderHoseDiameter = document.getElementById('cylinderHoseDiameter')?.value;
    const cylinderHoseLength = parseFloat(document.getElementById('cylinderHoseLength')?.value) || 5;

    // Prepare cost components
    const ruptureValveName = document.getElementById('ruptureSelect')?.value;
    const mainValveName = document.getElementById('mainValveSelect')?.value;

    const costComponents = {
        cylinder: {
            cylinderType: cylinderType,
            strokeMeters: strokeMeters,
            quantity: inputCylinderCount,
            isTwoPiece: isTwoPiece
        },
        motorName: motorName,
        pumpName: pumpName,
        powerUnitName: powerUnitName,
        ruptureValveName: ruptureValveName,
        mainValveName: mainValveName,
        hoses: mainHoseDiameter ? {
            mainDiameter: mainHoseDiameter,
            mainLength: mainHoseLength,
            cylinderDiameter: cylinderHoseDiameter || mainHoseDiameter,
            cylinderLength: inputCylinderCount > 1 ? cylinderHoseLength : 0,
            cylinderCount: inputCylinderCount > 1 ? inputCylinderCount : 0 // 1 cylinder = no cylinder hose, 2+ = cylinder count hoses
        } : null,
        accessories: accessories.filter(a => a.included).map(a => a.name)
    };

    const { totalCost, breakdown } = calculateSystemCost(costComponents);

    console.log('=== updateCylinderPricing ===');
    console.log('Accessories:', costComponents.accessories);
    console.log('Hoses config:', costComponents.hoses);
    console.log('Power unit breakdown:', breakdown.powerUnit);
    console.log('Cost breakdown:', breakdown);
    console.log('Power unit hoses selected:', costComponents.accessories.includes("Güç Ünitesi Hortumları"));

    // Update display
    const costBreakdownHTML = `
        <div class="cost-breakdown-item">
            <div class="cost-breakdown-label">Silindirler (${inputCylinderCount}x)${isTwoPiece ? ' - İki Parça' : ''}</div>
            <div class="cost-breakdown-value">${breakdown.cylinders.toFixed(0)} €</div>
        </div>
        <div class="cost-breakdown-item">
            <div class="cost-breakdown-label">Motor</div>
            <div class="cost-breakdown-value">${breakdown.motor.toFixed(0)} €</div>
        </div>
        <div class="cost-breakdown-item">
            <div class="cost-breakdown-label">Pompa</div>
            <div class="cost-breakdown-value">${breakdown.pump.toFixed(0)} €</div>
        </div>
        <div class="cost-breakdown-item">
            <div class="cost-breakdown-label">Güç Ünitesi${costComponents.accessories.includes("Güç Ünitesi Hortumları") ? ' (Hortumlu)' : ''}</div>
            <div class="cost-breakdown-value">${breakdown.powerUnit.toFixed(0)} €</div>
        </div>
        <div class="cost-breakdown-item">
            <div class="cost-breakdown-label">Patlak Hortum Valfi</div>
            <div class="cost-breakdown-value">${breakdown.ruptureValve.toFixed(0)} €</div>
        </div>
        <div class="cost-breakdown-item">
            <div class="cost-breakdown-label">Ana Kontrol Valfi</div>
            <div class="cost-breakdown-value">${breakdown.mainValve.toFixed(0)} €</div>
        </div>
        <div class="cost-breakdown-item">
            <div class="cost-breakdown-label">Aksesuarlar</div>
            <div class="cost-breakdown-value">${breakdown.accessories.toFixed(0)} €</div>
        </div>
        `;

    document.getElementById('costBreakdown').innerHTML = costBreakdownHTML;
    document.getElementById('totalCost').textContent = `${totalCost.toFixed(0)} €`;

    // Update Accessory Cost Display in Header
    const accessoryCostDisplay = document.getElementById('accessoryCostDisplay');
    if (accessoryCostDisplay) {
        const totalAccessoryDisplay = breakdown.accessories + (breakdown.powerUnitHoseCost || 0);
        accessoryCostDisplay.textContent = `${totalAccessoryDisplay.toFixed(0)} €`;
    }

    if (document.getElementById('topTotalCost')) {
        document.getElementById('topTotalCost').textContent = `${totalCost.toFixed(0)} €`;
    }
}

function updateHoseCost() {
    // Get hose configuration
    const mainDiameter = document.getElementById('mainHoseDiameter')?.value;
    const mainLength = parseFloat(document.getElementById('mainHoseLength')?.value) || 0;
    const cylinderCount = parseInt(document.getElementById('cylinderCount').value);

    if (!mainDiameter) return;

    let cylinderDiameter, cylinderLength;

    // Read cylinder hose values (now always visible)
    cylinderDiameter = document.getElementById('cylinderHoseDiameter')?.value;
    cylinderLength = parseFloat(document.getElementById('cylinderHoseLength')?.value) || 0;

    // Fallback if element missing (shouldn't happen with new HTML)
    if (!cylinderDiameter) {
        cylinderDiameter = mainDiameter;
        cylinderLength = 0;
    }

    // Recalculate total cost including hoses
    updateCylinderPricing();
}

function updateAccessoryStatus(index) {
    const checkbox = document.getElementById(`acc_${index}`);
    const statusSpan = document.getElementById(`acc_status_${index}`);

    if (checkbox && statusSpan) {
        // Update global accessories array
        if (accessories[index]) {
            accessories[index].included = checkbox.checked;
        }

        if (checkbox.checked) {
            statusSpan.textContent = 'Dahil';
            statusSpan.style.background = 'rgba(74, 222, 128, 0.2)';
            statusSpan.style.color = '#4ade80';
        } else {
            statusSpan.textContent = 'Dahil Değildir';
            statusSpan.style.background = 'rgba(248, 113, 113, 0.2)';
            statusSpan.style.color = '#f87171';
        }

        // Recalculate costs when accessories change (especially for power unit hoses)
        updateCylinderPricing();
    }
}


function updatePowerUnitInfo() {
    const selectedModel = document.getElementById('powerUnitSelect').value;
    const selectedUnit = powerUnits.find(u => u.model === selectedModel);

    if (selectedUnit) {
        // Update Total Oil
        const totalOilDisplay = document.getElementById('totalOilDisplay');
        if (totalOilDisplay) {
            totalOilDisplay.textContent = `${selectedUnit.totalOil.toFixed(1)} L`;
        }

        // Update Dead Zone
        const deadZoneDisplay = document.getElementById('deadZoneDisplay');
        if (deadZoneDisplay) {
            deadZoneDisplay.textContent = `${selectedUnit.deadZone} L`;
        }

        // Update Dimensions
        const dimensionsDisplay = document.getElementById('dimensionsDisplay');
        if (dimensionsDisplay) {
            dimensionsDisplay.textContent = `${selectedUnit.length} × ${selectedUnit.width} × ${selectedUnit.height} mm`;
        }
    }
}

function updateRuptureValveOptions() {
    const ruptureSelect = document.getElementById('ruptureSelect');
    if (!ruptureSelect) return; // Element doesn't exist yet

    const cylinderCount = parseInt(document.getElementById('cylinderCount').value) || 1;
    const needsDK = cylinderCount >= 2;
    const currentValue = ruptureSelect.value; // Save current selection

    // Use local list to ensure data availability and avoid filtering
    const burstHoseValvesList = [
        { size: '0.5"', name: "0,5'' R10L A-0,5'' G / T A-0,5'' G", hasDK: false, price: 116.52 },
        { size: '0.75"', name: "0,75'' R10L A-0,75'' G / T A-0,75'' G", hasDK: false, price: 129.99 },
        { size: '0.75"', name: "0,75'' R10L A-0,75'' G / T A-0,75'' G + DK", hasDK: true, price: 129.99 },
        { size: '1.0"', name: "1,0'' R10L A-1,0'' G / T A-1,0'' G", hasDK: false, price: 129.99 },
        { size: '1.0"', name: "1,0'' R10L A-1,0'' G / T A-1,0'' G + DK", hasDK: true, price: 143.98 },
        { size: '1.5"', name: "1,5'' R10L A-1,5'' G / T A-1,5'' G", hasDK: false, price: 158.02 },
        { size: '1.5"', name: "1,5'' R10L A-1,5'' G / T A-1,5'' G + DK", hasDK: true, price: 172.00 },
        { size: '2.0"', name: "2,0'' R10L A-2,0'' G / T A-2,0'' G", hasDK: false, price: 212.86 },
        { size: '2.0"', name: "2,0'' R10L A-2,0'' G / T A-2,0'' G + DK", hasDK: true, price: 226.86 }
    ];

    // Recalculate recommendation logic
    // We need speed, cylinder count, and suspension to calculate flow per cylinder
    const speed = parseFloat(document.getElementById('speed').value) || 0;
    const suspension = document.getElementById('suspension').value;
    const suspensionFactor = (suspension === '2:1') ? 2 : 1;

    // Get cylinder area (need to find selected cylinder data)
    // We can try to get it from calculatedResults if available, or re-find it
    let area = 0;
    if (selectedCylinder && calculatedResults) {
        const res = calculatedResults.find(r => r.type === selectedCylinder);
        if (res) {
            area = Math.pow(res.d, 2) * Math.PI * 0.25;
        }
    }

    let recommendedValveName = "";

    if (area > 0) {
        const maxSpeed = speed + 0.3;
        const maxFlowPerCylinder = (maxSpeed * area * 60) / (suspensionFactor * 1000);

        let ruptureSize = "Aralık Dışında";
        if (maxFlowPerCylinder <= 55) ruptureSize = "0.5\"";
        else if (maxFlowPerCylinder <= 100) ruptureSize = "0.75\"";
        else if (maxFlowPerCylinder <= 165) ruptureSize = "1.0\"";
        else if (maxFlowPerCylinder <= 400) ruptureSize = "1.5\"";
        else if (maxFlowPerCylinder <= 1200) ruptureSize = "2.0\"";

        // Find recommended valve
        let recommendedValveObj = burstHoseValvesList.find(v => v.size === ruptureSize && v.hasDK === needsDK);

        // Fallback logic
        if (!recommendedValveObj && needsDK && ruptureSize === "0.5\"") {
            recommendedValveObj = burstHoseValvesList.find(v => v.size === "0.75\"" && v.hasDK === true);
        }

        if (recommendedValveObj) {
            recommendedValveName = recommendedValveObj.name;
        }
    }

    // Build options (Show ALL valves)
    let options = '<option value="Yok">Yok (İstemiyorum)</option>';

    burstHoseValvesList.forEach(v => {
        const isRecommended = v.name === recommendedValveName ? ' (Önerilen)' : '';
        const isSelected = v.name === recommendedValveName ? 'selected' : ''; // Optional: Auto-select recommended if current is invalid? No, keep user selection.
        options += `<option value="${v.name}">${v.name}${isRecommended}</option>`;
    });

    ruptureSelect.innerHTML = options;

    // Try to restore previous selection
    // If the exact name exists, keep it.
    const optionExists = Array.from(ruptureSelect.options).some(opt => opt.value === currentValue);
    if (optionExists) {
        ruptureSelect.value = currentValue;
    } else {
        // If exact match not found (e.g. switched from Single to Multi), try to find same size?
        // For now, let's just default to Yok or let user choose.
        // Or if we want to be nice, we could try to map sizes.
        // But simple is better for now to avoid errors.
        ruptureSelect.value = "Yok";
    }
}

function updateMotorDetails() {
    const motorName = document.getElementById('motorSelect').value;
    const motor = motors.find(m => m.name === motorName);
    const voltage = document.getElementById('voltageSelect').value;

    if (!motor) return;

    // Calculate Nominal Current
    // Formula: (1.5 * kW * 1000) / (1.732 * Voltage * 0.79)
    // Calculate Nominal Current
    // Formula: (1.5 * kW * 1000) / (1.732 * Voltage * 0.79)
    const vVal = voltage === '380' ? 400 : 230;
    const nominalCurrent = (1.5 * motor.kw * 1000) / (1.732 * vVal * 0.79);

    // Get Star and Delta Currents
    let starCurrent = 0;
    let deltaCurrent = 0;

    if (voltage === '380') {
        if (motor.current380) {
            starCurrent = motor.current380.star;
            deltaCurrent = motor.current380.delta;
        }
    } else {
        // 220V
        if (motor.current220) {
            starCurrent = motor.current220.star;
            deltaCurrent = motor.current220.delta;
        } else {
            // Fallback if no 220V data (for larger motors)
            starCurrent = "-";
            deltaCurrent = "-";
        }
    }

    // Update Display - Update individual elements instead of replacing HTML
    const detailsDiv = document.getElementById('motorDetails');
    if (detailsDiv) {
        // If the new structure exists (check for specific IDs)
        if (document.getElementById('motorModelDisplay')) {
            document.getElementById('motorModelDisplay').textContent = motor.name;
            document.getElementById('motorPowerDisplay').textContent = `${motor.kw} kW`;
            document.getElementById('motorNominalDisplay').textContent = `${nominalCurrent.toFixed(1)} A`;
            document.getElementById('motorStarDisplay').textContent = `${starCurrent} A`;
            document.getElementById('motorDeltaDisplay').textContent = `${deltaCurrent} A`;
        } else {
            // Fallback for safety if structure is somehow different
            // Try to preserve p_req if possible, otherwise it might be lost until next calc
            const currentReqPower = document.getElementById('reqPowerDisplay')?.textContent || '-';

            detailsDiv.innerHTML = `
                <div class="spec-row" style="background-color: rgba(37, 99, 235, 0.1); border: 1px solid rgba(37, 99, 235, 0.2);">
                    <span class="spec-label" style="color: var(--primary); font-weight: 700;">Gerekli Güç</span>
                    <span class="spec-value" id="reqPowerDisplay" style="color: var(--primary); font-weight: 700;">${currentReqPower}</span>
                </div>
                <div class="spec-row">
                    <span class="spec-label">Model</span>
                    <span class="spec-value" id="motorModelDisplay">${motor.name}</span>
                </div>
                <div class="spec-row">
                    <span class="spec-label">Seçilen Güç</span>
                    <span class="spec-value" id="motorPowerDisplay">${motor.kw} kW</span>
                </div>
                <div class="spec-row">
                    <span class="spec-label">Nominal Akım</span>
                    <span class="spec-value text-warning" id="motorNominalDisplay">${nominalCurrent.toFixed(1)} A</span>
                </div>
                <div class="spec-row">
                    <span class="spec-label">Yıldız Akım</span>
                    <span class="spec-value text-warning" id="motorStarDisplay">${starCurrent} A</span>
                </div>
                <div class="spec-row">
                    <span class="spec-label">Üçgen Akım</span>
                    <span class="spec-value text-warning" id="motorDeltaDisplay">${deltaCurrent} A</span>
                </div>
        `;
        }
    }
}

// updateValveDisplay is no longer needed as dropdowns show the full name directly
function updateValveDisplay() { }

function updateCalculations(cylinderType) {
    const result = calculatedResults.find(r => r.type === cylinderType);
    if (!result) return;

    const pumpName = document.getElementById('pumpSelect').value;
    const selectedPump = pumps.find(p => p.name === pumpName);

    const cylinderCount = parseInt(document.getElementById('cylinderCount').value);
    const suspension = document.getElementById('suspension').value;
    const suspensionFactor = (suspension === '2:1') ? 2 : 1;
    const area = Math.pow(result.d, 2) * Math.PI * 0.25;

    // Recalculate Speed
    const q_actual = selectedPump.flow;
    const speed_eff = (q_actual * suspensionFactor * 1000) / (area * 60 * cylinderCount);
    document.getElementById('effectiveSpeedDisplay').textContent = `${speed_eff.toFixed(3)} m / s`;

    // Recalculate Required Power
    const p_req = (q_actual * parseFloat(result.pressureFull) * 1.3) / 600;
    document.getElementById('reqPowerDisplay').textContent = `${p_req.toFixed(1)} kW`;

    // Update Motor Options (to show warnings for new power req)
    const motorSelect = document.getElementById('motorSelect');
    const currentMotor = motorSelect.value;

    // Re-render motor options
    // We need to find the recommended motor for this new power
    let recommendedMotor = motors.find(m => m.kw >= p_req);
    if (!recommendedMotor) recommendedMotor = motors[motors.length - 1];

    const newOptions = motors.map(m => {
        // Keep current selection if valid, else select recommended
        // Actually, user might want to keep their manual selection unless it's invalid?
        // Let's just mark the recommended one.
        const isSelected = m.name === currentMotor ? 'selected' : '';
        const isRecommended = m.name === recommendedMotor.name ? ' (Önerilen)' : '';
        const isSufficient = m.kw >= p_req;
        const style = isSufficient ? '' : 'color: #f87171;';
        const warning = isSufficient ? '' : ' (Yetersiz Güç)';
        return `<option value="${m.name}" style="${style}" ${isSelected}>${m.name} - ${m.kw} kW${isRecommended}${warning}</option>`;
    }).join('');

    motorSelect.innerHTML = newOptions;
}

function updateFeatureCard(checkbox) {
    const card = checkbox.closest('.feature-card');
    if (card) {
        if (checkbox.checked) {
            card.classList.add('active');
        } else {
            card.classList.remove('active');
        }
    }
}



// Event Listeners
// Navigation Helper
function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.content-section').forEach(el => el.classList.add('hidden'));

    // Show target section
    const target = document.getElementById(sectionId);
    if (target) {
        target.classList.remove('hidden');
        // Scroll to top of section to ensure visibility
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Update sidebar active state
    document.querySelectorAll('.nav-item').forEach(btn => btn.classList.remove('active'));

    // Set active button based on section
    if (sectionId === 'projectSection') {
        const newProjectBtn = document.getElementById('newProjectBtn');
        if (newProjectBtn) newProjectBtn.classList.add('active');

        // Show Save/Update button only in Project Form
        const headerSaveBtn = document.getElementById('headerSaveBtn');
        if (headerSaveBtn) headerSaveBtn.style.display = 'inline-flex';
    } else if (sectionId === 'projectsListSection') {
        document.getElementById('openProjectsBtn').classList.add('active');

        // Hide Save/Update button in Projects List
        const headerSaveBtn = document.getElementById('headerSaveBtn');
        if (headerSaveBtn) headerSaveBtn.style.display = 'none';
    } else {
        // Hide for other sections too (e.g. production)
        const headerSaveBtn = document.getElementById('headerSaveBtn');
        if (headerSaveBtn) headerSaveBtn.style.display = 'none';
    }
}

const openProjectsBtn = document.getElementById('openProjectsBtn');
if (openProjectsBtn) {
    // Only add listener if it is NOT a link (to avoid conflict with href) or if we want to support SPA mode.
    // If it is an anchor tag, let it navigate.
    if (openProjectsBtn.tagName !== 'A') {
        openProjectsBtn.addEventListener('click', () => {
            loadProjectsList();
            showSection('projectsListSection');
        });
    }
}

// Event Listeners
const newProjectBtn = document.getElementById('newProjectBtn');
if (newProjectBtn && newProjectBtn.tagName !== 'A') {
    newProjectBtn.addEventListener('click', () => {
        resetToNewProject();
        showSection('projectSection');
    });
}

const saveProjectBtn = document.getElementById('saveProjectBtn');
if (saveProjectBtn) {
    saveProjectBtn.addEventListener('click', saveProject);
}

const updateProjectBtn = document.getElementById('updateProjectBtn');
if (updateProjectBtn) {
    updateProjectBtn.addEventListener('click', updateProject);
}

const openProdBtn = document.getElementById('openProductionBtn');
if (openProdBtn && openProdBtn.tagName !== 'A') {
    openProdBtn.addEventListener('click', () => {
        // If we are separating pages, this might need to redirect instead of showing section.
        // But for backward compatibility with SPA structure if any:
        loadProjectsList('production');
        showSection('projectsListSection');
    });
}

const adminPanelBtn = document.getElementById('adminPanelBtn');
if (adminPanelBtn && adminPanelBtn.tagName !== 'A') {
    adminPanelBtn.addEventListener('click', () => {
        window.location.href = 'admin.html';
    });
}

const logoutBtn = document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (typeof Auth !== 'undefined') {
            Auth.logout();
        } else {
            window.location.href = 'login.html';
        }
    });
}


// Sidebar listeners kept for compatibility if needed
function closeSidebar() {
    // No-op
}

// Check for auto-load project from projects.html or other sources
document.addEventListener('DOMContentLoaded', () => {
    const projectToLoad = localStorage.getItem('projectToLoad');
    if (projectToLoad) {
        // Clear it immediately so it doesn't reload on refresh
        localStorage.removeItem('projectToLoad');
        // Small delay to ensure data is ready
        setTimeout(() => {
            loadProject(projectToLoad);
            showSection('projectSection');
        }, 100);
    }
});


// Auto-capitalize Customer Name
document.addEventListener('DOMContentLoaded', () => {
    const customerNameInput = document.getElementById('customerName');
    if (customerNameInput) {
        customerNameInput.addEventListener('input', function (e) {
            const start = this.selectionStart;
            const end = this.selectionEnd;

            const words = this.value.split(' ');
            const capitalizedWords = words.map(word => {
                if (word.length === 0) return word;
                return word.charAt(0).toLocaleUpperCase('tr-TR') + word.slice(1);
            });

            this.value = capitalizedWords.join(' ');

            // Restore cursor
            this.setSelectionRange(start, end);
        });
    }
});


