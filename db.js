
// Initialize Supabase Client
const SUPABASE_URL = 'https://mtpyepyergsyofhggqvo.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im10cHllcHllcmdzeW9maGdncXZvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc3NjYxMDEsImV4cCI6MjA4MzM0MjEwMX0.1LSq8Fmfo7Wii9xvwNo17Bwy9MBxoHZhqCTiNiFNAGc';

// Simple Supabase Client using REST API (No npm required)
const db = {
    async query(endpoint, method = 'GET', body = null) {
        const headers = {
            'apikey': SUPABASE_KEY,
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation' // Return inserted/updated data
        };

        const options = { method, headers };
        if (body) options.body = JSON.stringify(body);

        try {
            const response = await fetch(`${SUPABASE_URL}/rest/v1/${endpoint}`, options);
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Database Error');
            }
            return await response.json();
        } catch (error) {
            console.error('DB Error:', error);
            throw error;
        }
    },

    // Projects API
    projects: {
        async getAll() {
            return await db.query('projects?select=*&order=created_at.desc');
        },
        async create(projectData) {
            // Remove 'id' if present to let DB auto-generate it
            const { id, ...data } = projectData;
            return await db.query('projects', 'POST', data);
        },
        async update(projectNumber, updates) {
            // Filter by project_number
            return await db.query(`projects?project_number=eq.${projectNumber}`, 'PATCH', updates);
        },
        async delete(projectNumber) {
            return await db.query(`projects?project_number=eq.${projectNumber}`, 'DELETE');
        }
    },

    // Users API
    users: {
        async getAll() {
            return await db.query('app_users?select=*');
        },
        async getByUsername(username) {
            const users = await db.query(`app_users?username=eq.${username}&select=*`);
            return users.length > 0 ? users[0] : null;
        },
        async create(userData) {
            return await db.query('app_users', 'POST', userData);
        },
        async delete(username) {
            return await db.query(`app_users?username=eq.${username}`, 'DELETE');
        }
    }
};

// Expose globally
window.db = db;
