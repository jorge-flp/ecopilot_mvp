/**
 * EcoPilot Authentication Service
 * Uses LocalStorage to simulate a backend database.
 */

class UserDatabase {
    constructor() {
        this.dbName = 'ecotrip_users';
    }

    getUsers() {
        const users = localStorage.getItem(this.dbName);
        return users ? JSON.parse(users) : [];
    }

    saveUser(user) {
        const users = this.getUsers();
        users.push(user);
        localStorage.setItem(this.dbName, JSON.stringify(users));
    }

    findUserByEmail(email) {
        const users = this.getUsers();
        return users.find(u => u.email === email);
    }
}

class AuthService {
    constructor() {
        this.db = new UserDatabase();
        this.sessionKey = 'ecotrip_session';
    }

    /**
     * Register a new user
     * @param {string} name 
     * @param {string} email 
     * @param {string} password 
     * @returns {object} Result { success: boolean, message: string }
     */
    register(name, email, password) {
        if (this.db.findUserByEmail(email)) {
            return { success: false, message: 'Este email já está cadastrado.' };
        }

        const newUser = {
            id: Date.now().toString(),
            name,
            email,
            password: btoa(password), // Simple encoding (NOT secure for production, but fine for demo)
            isPremium: false, // User starts without subscription
            subscriptionDate: null,
            createdAt: new Date().toISOString()
        };

        this.db.saveUser(newUser);
        return { success: true, message: 'Cadastro realizado com sucesso!' };
    }

    /**
     * Login a user
     * @param {string} email 
     * @param {string} password 
     * @returns {object} Result { success: boolean, message: string, user: object }
     */
    login(email, password) {
        const user = this.db.findUserByEmail(email);

        if (!user) {
            return { success: false, message: 'Email não encontrado.' };
        }

        if (user.password !== btoa(password)) {
            return { success: false, message: 'Senha incorreta.' };
        }

        this.setSession(user);
        return { success: true, message: 'Login realizado com sucesso!', user };
    }

    /**
     * Update user password
     * @param {string} email 
     * @param {string} currentPassword 
     * @param {string} newPassword 
     * @returns {object} Result { success: boolean, message: string }
     */
    updatePassword(email, currentPassword, newPassword) {
        const user = this.db.findUserByEmail(email);

        if (!user) {
            return { success: false, message: 'Usuário não encontrado.' };
        }

        if (user.password !== btoa(currentPassword)) {
            return { success: false, message: 'Senha atual incorreta.' };
        }

        // Update password
        user.password = btoa(newPassword);

        // Save updated user list
        const users = this.db.getUsers();
        const index = users.findIndex(u => u.email === email);
        if (index !== -1) {
            users[index] = user;
            localStorage.setItem(this.db.dbName, JSON.stringify(users));
            return { success: true, message: 'Senha alterada com sucesso!' };
        }

        return { success: false, message: 'Erro ao atualizar senha.' };
    }

    /**
     * Logout the current user
     */
    logout() {
        localStorage.removeItem(this.sessionKey);
        window.location.href = 'index.html';
    }

    /**
     * Get the currently logged in user
     * @returns {object|null}
     */
    getCurrentUser() {
        const session = localStorage.getItem(this.sessionKey);
        return session ? JSON.parse(session) : null;
    }

    /**
     * Private: Set session
     */
    setSession(user) {
        // Don't store password in session
        const { password, ...safeUser } = user;
        localStorage.setItem(this.sessionKey, JSON.stringify(safeUser));
    }

    /**
     * Subscribe user to premium plan
     * @param {string} email 
     * @returns {object} Result { success: boolean, message: string }
     */
    subscribe(email) {
        const user = this.db.findUserByEmail(email);

        if (!user) {
            return { success: false, message: 'Usuário não encontrado.' };
        }

        if (user.isPremium) {
            return { success: false, message: 'Você já possui uma assinatura ativa.' };
        }

        // Activate premium subscription
        user.isPremium = true;
        user.subscriptionDate = new Date().toISOString();

        // Save updated user list
        const users = this.db.getUsers();
        const index = users.findIndex(u => u.email === email);
        if (index !== -1) {
            users[index] = user;
            localStorage.setItem(this.db.dbName, JSON.stringify(users));

            // Update current session
            this.setSession(user);

            return { success: true, message: 'Assinatura ativada com sucesso!' };
        }

        return { success: false, message: 'Erro ao ativar assinatura.' };
    }

    /**
     * Check if user has premium subscription
     * @returns {boolean}
     */
    isPremiumUser() {
        const user = this.getCurrentUser();
        return user ? user.isPremium === true : false;
    }

    /**
     * Cancel user's premium subscription
     * @param {string} email 
     * @returns {object} Result { success: boolean, message: string }
     */
    cancelSubscription(email) {
        const user = this.db.findUserByEmail(email);

        if (!user) {
            return { success: false, message: 'Usuário não encontrado.' };
        }

        if (!user.isPremium) {
            return { success: false, message: 'Você não possui uma assinatura ativa.' };
        }

        // Cancel premium subscription
        user.isPremium = false;
        user.subscriptionDate = null;

        // Save updated user list
        const users = this.db.getUsers();
        const index = users.findIndex(u => u.email === email);
        if (index !== -1) {
            users[index] = user;
            localStorage.setItem(this.db.dbName, JSON.stringify(users));

            // Update current session
            this.setSession(user);

            return { success: true, message: 'Assinatura cancelada com sucesso.' };
        }

        return { success: false, message: 'Erro ao cancelar assinatura.' };
    }
}

// Export a singleton instance
const auth = new AuthService();
