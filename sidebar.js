document.addEventListener('DOMContentLoaded', () => {
    // Navigation Highlighting
    const navItems = document.querySelectorAll('.nav-item');
    const currentPath = window.location.pathname;

    navItems.forEach(item => {
        // If it's a link (<a> tag)
        if (item.tagName === 'A') {
            const href = item.getAttribute('href');
            if (currentPath.includes(href)) {
                setActive(item);
            }
        } 
        // If it's a button (handled by JS usually, but we can toggle active state on click)
        else {
            item.addEventListener('click', () => {
                // Remove active from all others
                setActive(item);
            });
        }
    });

    function setActive(targetItem) {
        navItems.forEach(item => item.classList.remove('active'));
        targetItem.classList.add('active');
    }

    // Toggle Sidebar functionality (if we add a toggle button later)
    // Currently forced to collapsed via inline script
});
