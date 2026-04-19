const registerForm = document.getElementById("registerForm");
const registerMessage = document.getElementById("formMessage");

if (getToken()) {
  window.location.href = "home.html";
}

registerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const formData = new FormData(registerForm);
  const nome = formData.get("nome")?.toString().trim();
  const email = formData.get("email")?.toString().trim();
  const senha = formData.get("senha")?.toString();

  showMessage(registerMessage, "Criando seu acesso...", "success");

  try {
    await apiRequest("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ nome, email, senha })
    });

    showMessage(registerMessage, "Conta criada com sucesso. Você já pode fazer login.", "success");
    registerForm.reset();

    setTimeout(() => {
      window.location.href = "login.html";
    }, 900);
  } catch (error) {
    showMessage(registerMessage, error.message, "error");
  }
});
