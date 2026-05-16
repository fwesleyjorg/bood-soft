async function hashPassword(message) {
    const msgBuffer = new TextEncoder().encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

let tempEmailForVerification = '';
let currentOTP = '';
let tempResetToken = '';
let loginAttempts = {};
const MAX_LOGIN_ATTEMPTS = 5;
const ATTEMPT_TIMEOUT = 15 * 60 * 1000; // 15 minutos

async function initDB() {
    let users = JSON.parse(localStorage.getItem('users') || '{}');
    if (!users['admin@email.com']) {
        users['admin@email.com'] = {
            name: 'Administrador (Teste)',
            email: 'admin@email.com',
            password: await hashPassword('Admin@123456'),
            verified: true,
            createdAt: new Date().toLocaleDateString('pt-BR'),
            loginCount: 0,
            lastOnline: new Date().toLocaleString('pt-BR')
        };
        localStorage.setItem('users', JSON.stringify(users));
    }
    loadTheme();
    switchView('view-login');
}

function switchView(viewId) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(viewId).classList.add('active');
}

function togglePassword(inputId) {
    const input = document.getElementById(inputId);
    const icon = input.parentElement.querySelector('.password-toggle');
    if (input.type === "password") {
        input.type = "text";
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
        input.type = "password";
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
}

const pwdInput = document.getElementById('reg-password');
if (pwdInput) {
    const pwdBar = document.getElementById('pwd-bar');
    const pwdText = document.getElementById('pwd-text');

    pwdInput.addEventListener('input', () => {
        const val = pwdInput.value;
        let strength = 0;
        if(val.length >= 8) strength++;
        if(/[A-Z]/.test(val)) strength++;
        if(/[0-9]/.test(val)) strength++;
        if(/[^A-Za-z0-9]/.test(val)) strength++;

        pwdBar.style.width = (strength * 25) + '%';
        
        if(strength === 0) { 
            pwdBar.style.background = 'transparent'; 
            pwdText.textContent = ''; 
        }
        else if(strength <= 2) { 
            pwdBar.style.background = '#EF4444'; 
            pwdText.textContent = 'Fraca'; 
            pwdText.style.color = '#EF4444';
        }
        else if(strength === 3) { 
            pwdBar.style.background = '#F59E0B'; 
            pwdText.textContent = 'Média'; 
            pwdText.style.color = '#F59E0B';
        }
        else { 
            pwdBar.style.background = '#10B981'; 
            pwdText.textContent = 'Forte'; 
            pwdText.style.color = '#10B981';
        }
    });
}

function isPasswordStrong(pwd) {
    return /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(pwd);
}

function moveToNext(t, e) {
    if(e.key === 'Backspace') {
        if(t.previousElementSibling) t.previousElementSibling.focus();
    } else if(t.value.length === 1 && /[0-9]/.test(t.value)) {
        if(t.nextElementSibling) t.nextElementSibling.focus();
    } else if (t.value.length > 1) {
        t.value = t.value.slice(-1);
    }
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.3s forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function openModal(id) { 
    document.getElementById(id).classList.add('active'); 
}

function closeModal(id) { 
    document.getElementById(id).classList.remove('active'); 
}

function toggleTheme() {
    const body = document.body;
    const icon = document.querySelector('#theme-btn i');
    
    body.classList.toggle('dark-mode');
    
    if (body.classList.contains('dark-mode')) {
        if(icon) icon.classList.replace('fa-moon', 'fa-sun');
        localStorage.setItem('theme', 'dark');
    } else {
        if(icon) icon.classList.replace('fa-sun', 'fa-moon');
        localStorage.setItem('theme', 'light');
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const icon = document.querySelector('#theme-btn i');
    
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        if (icon) icon.classList.replace('fa-moon', 'fa-sun');
    } else {
        document.body.classList.remove('dark-mode');
        if (icon) icon.classList.replace('fa-sun', 'fa-moon');
    }
}

// ============ SIGNUP ============
document.getElementById('form-signup').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pwd = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    // Validações
    if (!name) {
        return showToast('Por favor, insira seu nome completo.', 'error');
    }

    if (pwd !== confirm) {
        return showToast('As senhas não coincidem.', 'error');
    }

    if (!isPasswordStrong(pwd)) {
        return showToast('Senha fraca: mínimo 8 caracteres, 1 maiúscula, 1 número e 1 símbolo.', 'error');
    }

    let users = JSON.parse(localStorage.getItem('users') || '{}');
    if (users[email]) {
        return showToast(`⚠️ Este e-mail (${email}) já está cadastrado. Tente fazer login ou use outro e-mail.`, 'error');
    }

    const hashedPwd = await hashPassword(pwd);
    
    users[email] = {
        name, email, password: hashedPwd, verified: false,
        createdAt: new Date().toLocaleDateString('pt-BR'),
        loginCount: 0, lastOnline: null
    };
    localStorage.setItem('users', JSON.stringify(users));
    
    tempEmailForVerification = email;
    generateOTP();
    showToast(`Cadastro realizado! Verifique seu e-mail para ativar a conta.`, 'success');
    switchView('view-verify');
    document.getElementById('verify-subtitle').textContent = `Enviamos um código de verificação para ${email}`;
});

function generateOTP() {
    currentOTP = Math.floor(100000 + Math.random() * 900000).toString();
    // Não logar no console por segurança - apenas mostrar ao usuário via toast
    showToast(`📧 Código enviado! (Teste: ${currentOTP})`, 'success');
}

function resendCode() {
    generateOTP();
    showToast('✅ Novo código foi enviado.', 'success');
}

// ============ VERIFY EMAIL ============
document.getElementById('form-verify').addEventListener('submit', (e) => {
    e.preventDefault();
    const inputs = document.querySelectorAll('#otp-container input');
    let code = Array.from(inputs).map(i => i.value).join('');
    
    if (!code || code.length < 6) {
        return showToast('Por favor, insira os 6 dígitos do código.', 'error');
    }

    if (code === currentOTP) {
        let users = JSON.parse(localStorage.getItem('users'));
        users[tempEmailForVerification].verified = true;
        localStorage.setItem('users', JSON.stringify(users));
        showToast('✅ E-mail verificado com sucesso! Faça login agora.', 'success');
        
        // Limpar inputs
        inputs.forEach(input => input.value = '');
        switchView('view-login');
    } else {
        showToast('❌ Código inválido. Tente novamente.', 'error');
    }
});

// ============ LOGIN ============
document.getElementById('form-login').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const pwd = document.getElementById('login-password').value;
    
    // Verificar tentativas de login
    const now = Date.now();
    if (loginAttempts[email]) {
        if (loginAttempts[email].count >= MAX_LOGIN_ATTEMPTS) {
            if (now - loginAttempts[email].firstAttempt < ATTEMPT_TIMEOUT) {
                const waitTime = Math.ceil((ATTEMPT_TIMEOUT - (now - loginAttempts[email].firstAttempt)) / 60000);
                return showToast(`⏳ Muitas tentativas. Aguarde ${waitTime} minuto(s).`, 'error');
            } else {
                loginAttempts[email] = { count: 0, firstAttempt: now };
            }
        }
    } else {
        loginAttempts[email] = { count: 0, firstAttempt: now };
    }

    let users = JSON.parse(localStorage.getItem('users') || '{}');
    const user = users[email];

    if (!user) {
        loginAttempts[email].count++;
        return showToast('❌ Usuário não encontrado.', 'error');
    }

    if (!user.verified) {
        tempEmailForVerification = email;
        generateOTP();
        return switchView('view-verify');
    }

    const hashedPwd = await hashPassword(pwd);
    if (user.password !== hashedPwd) {
        loginAttempts[email].count++;
        const remainingAttempts = MAX_LOGIN_ATTEMPTS - loginAttempts[email].count;
        if (remainingAttempts > 0) {
            showToast(`❌ Senha incorreta. ${remainingAttempts} tentativa(s) restante(s).`, 'error');
        } else {
            showToast(`⏳ Muitas tentativas incorretas. Aguarde 15 minutos.`, 'error');
        }
        return;
    }

    // Login bem-sucedido
    loginAttempts[email] = { count: 0, firstAttempt: now };
    user.loginCount += 1;
    user.lastOnline = new Date().toLocaleString('pt-BR');
    users[email] = user;
    localStorage.setItem('users', JSON.stringify(users));
    
    showToast(`👋 Bem-vindo, ${user.name}!`, 'success');
    
    // Limpar form
    document.getElementById('form-login').reset();
    
    // Redirecionar ou mostrar mensagem (sem dashboard, apenas feedback)
    setTimeout(() => {
        alert(`Login realizado com sucesso!\n\nBem-vindo, ${user.name}!\n\nTempo: ${new Date().toLocaleString('pt-BR')}`);
    }, 500);
});

// ============ FORGOT PASSWORD ============
document.getElementById('form-forgot').addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('forgot-email').value.trim();
    let users = JSON.parse(localStorage.getItem('users') || '{}');
    
    if (!users[email]) {
        return showToast('❌ E-mail não encontrado no sistema.', 'error');
    }

    tempResetToken = Math.random().toString(36).substring(2, 10).toUpperCase();
    document.getElementById('reset-email').value = email;
    
    showToast(`🔐 Token de recuperação gerado! (Teste: ${tempResetToken})`, 'success');
    switchView('view-reset');
});

// ============ RESET PASSWORD ============
document.getElementById('form-reset').addEventListener('submit', async (e) => {
    e.preventDefault();
    const token = document.getElementById('reset-token').value.trim();
    const pwd = document.getElementById('reset-password').value;
    const email = document.getElementById('reset-email').value;

    if (token !== tempResetToken) {
        return showToast('❌ Token inválido ou expirado.', 'error');
    }

    if (!isPasswordStrong(pwd)) {
        return showToast('Senha fraca: mínimo 8 caracteres, 1 maiúscula, 1 número e 1 símbolo.', 'error');
    }

    let users = JSON.parse(localStorage.getItem('users'));
    users[email].password = await hashPassword(pwd);
    localStorage.setItem('users', JSON.stringify(users));

    showToast('✅ Senha redefinida com sucesso! Faça login com sua nova senha.', 'success');
    document.getElementById('form-reset').reset();
    switchView('view-login');
});

// ============ OAUTH LOGIN ============
async function oauthLogin(provider) {
    const email = `user@${provider.toLowerCase()}.com`;
    let users = JSON.parse(localStorage.getItem('users') || '{}');
    
    if (!users[email]) {
        users[email] = {
            name: `Usuário do ${provider}`,
            email: email,
            password: await hashPassword(Math.random().toString(36)),
            verified: true,
            createdAt: new Date().toLocaleDateString('pt-BR'),
            loginCount: 0,
            lastOnline: null
        };
        localStorage.setItem('users', JSON.stringify(users));
        showToast(`🎉 Conta ${provider} criada e verificada!`, 'success');
    }

    let user = users[email];
    user.loginCount += 1;
    user.lastOnline = new Date().toLocaleString('pt-BR');
    users[email] = user;
    localStorage.setItem('users', JSON.stringify(users));

    showToast(`✅ Login com ${provider} realizado com sucesso!`, 'success');
    
    setTimeout(() => {
        alert(`Login com ${provider} realizado!\n\nBem-vindo, ${user.name}!`);
    }, 500);
}

// Fechar modal ao clicar fora
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.classList.remove('active');
    }
});

// Inicializar ao carregar a página
document.addEventListener('DOMContentLoaded', initDB);
