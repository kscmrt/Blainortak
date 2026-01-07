/**
 * auth.js
 * Authentication using Supabase Database via db.js
 */

const Auth = {
    // Current session
    currentUser: null,

    async init() {
        const stored = localStorage.getItem('currentUser');
        if (stored) {
            this.currentUser = JSON.parse(stored);
        }
    },

    async login(username, password) {
        try {
            const user = await db.users.getByUsername(username);

            if (user && user.password === password) {
                // Save session
                const session = {
                    username: user.username,
                    role: user.role || 'user',
                    loginTime: new Date().toISOString()
                };
                this.currentUser = session;
                localStorage.setItem('currentUser', JSON.stringify(session));
                return { success: true };
            } else {
                return { success: false, message: 'Kullanıcı adı veya şifre hatalı!' };
            }
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: 'Giriş yapılırken bir hata oluştu.' };
        }
    },

    logout() {
        this.currentUser = null;
        localStorage.removeItem('currentUser');
        window.location.href = 'login.html';
    },

    getCurrentUser() {
        return this.currentUser;
    },

    checkAuth() {
        if (!this.currentUser) {
            // Check local storage one last time synchronously
            const stored = localStorage.getItem('currentUser');
            if (stored) {
                this.currentUser = JSON.parse(stored);
                return true;
            }
            window.location.href = 'login.html';
            return false;
        }
        return true;
    },

    isAdmin() {
        return this.currentUser && this.currentUser.role === 'admin';
    },

    // Admin Functions
    async getUsers() {
        if (!this.isAdmin()) return [];
        return await db.users.getAll();
    },

    async addUser(username, password, role = 'user') {
        if (!this.isAdmin()) return { success: false, message: 'Yetkisiz işlem!' };

        try {
            const existing = await db.users.getByUsername(username);
            if (existing) {
                return { success: false, message: 'Bu kullanıcı adı zaten mevcut!' };
            }

            await db.users.create({ username, password, role });
            return { success: true, message: 'Kullanıcı başarıyla eklendi.' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    },

    async deleteUser(username) {
        if (!this.isAdmin()) return { success: false, message: 'Yetkisiz işlem!' };
        if (username === 'admin') return { success: false, message: 'Admin kullanıcısı silinemez!' };

        try {
            await db.users.delete(username);
            return { success: true, message: 'Kullanıcı silindi.' };
        } catch (error) {
            return { success: false, message: error.message };
        }
    }
};

// Initialize immediately
Auth.init();
