const loginForm = document.getElementById("loginForm");
const loginMessage = document.getElementById("formMessage");

if (getToken()) {
  window.location.href = "home.html";
}

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(loginForm);
  const email = formData.get("email")?.toString().trim();
  const senha = formData.get("senha")?.toString();

  showMessage(loginMessage, "Validando suas credenciais...", "success");

  try {
    const result = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, senha })
    });

    saveSession(result.token, result.user);
    showMessage(loginMessage, "Login realizado com sucesso. Redirecionando...", "success");

    setTimeout(() => {
      window.location.href = "home.html";
    }, 500);
  } catch (error) {
    showMessage(loginMessage, error.message, "error");
  }
});
