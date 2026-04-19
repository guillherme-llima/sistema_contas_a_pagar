const userName = document.getElementById("userName");
const userEmail = document.getElementById("userEmail");
const logoutButton = document.getElementById("logoutButton");

async function loadSession() {
  const token = getToken();
  const storedUser = getStoredUser();

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  if (storedUser) {
    userName.textContent = storedUser.nome;
    userEmail.textContent = `Conectado como ${storedUser.email}.`;
  }

  try {
    const result = await apiRequest("/api/auth/me");
    saveSession(token, result.user);
    userName.textContent = result.user.nome;
    userEmail.textContent = `Conectado como ${result.user.email}.`;
  } catch (error) {
    clearSession();
    window.location.href = "login.html";
  }
}

logoutButton?.addEventListener("click", () => {
  clearSession();
  window.location.href = "login.html";
});

loadSession();
