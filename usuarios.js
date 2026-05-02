const logoutButton = document.getElementById("logoutButton");
const userName = document.getElementById("userName");
const addButton = document.getElementById("addButton");
const editButton = document.getElementById("editButton");
const deleteButton = document.getElementById("deleteButton");
const printButton = document.getElementById("printButton");
const usersTableBody = document.getElementById("usersTableBody");
const listMessage = document.getElementById("listMessage");
const userModal = document.getElementById("userModal");
const closeModalButton = document.getElementById("closeModalButton");
const cancelModalButton = document.getElementById("cancelModalButton");
const modalTitle = document.getElementById("modalTitle");
const userForm = document.getElementById("userForm");
const userNomeInput = document.getElementById("userNome");
const userEmailInput = document.getElementById("userEmail");
const userSenhaInput = document.getElementById("userSenha");
const formMessage = document.getElementById("formMessage");

let users = [];
let selectedUserId = null;
let editingUserId = null;

function setListMessage(message, type) {
  listMessage.textContent = message;
  listMessage.classList.remove("is-error", "is-success");

  if (type) {
    listMessage.classList.add(type === "error" ? "is-error" : "is-success");
  }
}

function setSelection(userId) {
  selectedUserId = userId;
  editButton.disabled = !selectedUserId;
  deleteButton.disabled = !selectedUserId;
  renderUsersTable();
}

function renderUsersTable() {
  if (users.length === 0) {
    usersTableBody.innerHTML = `
      <tr>
        <td colspan="5">Nenhum usuario cadastrado.</td>
      </tr>
    `;
    return;
  }

  usersTableBody.innerHTML = users.map((user) => {
    const checked = user.id === selectedUserId ? "checked" : "";
    const selectedClass = user.id === selectedUserId ? "is-selected" : "";

    return `
      <tr class="${selectedClass}">
        <td class="check-column"><input type="radio" name="selectedUser" value="${user.id}" ${checked}></td>
        <td>${user.id}</td>
        <td>${user.nome}</td>
        <td>${user.email}</td>
        <td>${user.perfil}</td>
      </tr>
    `;
  }).join("");

  usersTableBody.querySelectorAll('input[name="selectedUser"]').forEach((input) => {
    input.addEventListener("change", () => setSelection(Number(input.value)));
  });
}

async function loadSession() {
  const token = getToken();
  const storedUser = getStoredUser();

  if (!token) {
    window.location.href = "login.html";
    return;
  }

  if (storedUser) {
    userName.textContent = storedUser.nome;
  }

  try {
    const result = await apiRequest("/api/auth/me");
    saveSession(token, result.user);
    userName.textContent = result.user.nome;
  } catch {
    clearSession();
    window.location.href = "login.html";
  }
}

async function loadUsers() {
  setListMessage("Carregando usuarios...");

  try {
    const result = await apiRequest("/api/users");
    users = result.users || [];
    renderUsersTable();
    setListMessage(`${users.length} registro(s) carregado(s).`, "success");
  } catch (error) {
    setListMessage(error.message, "error");
  }
}

function openModal(mode, user) {
  editingUserId = mode === "edit" ? user.id : null;
  modalTitle.textContent = mode === "edit" ? "Editar usuario" : "Novo usuario";
  userNomeInput.value = user?.nome || "";
  userEmailInput.value = user?.email || "";
  userSenhaInput.value = "";
  userSenhaInput.required = mode !== "edit";
  formMessage.textContent = "";
  formMessage.classList.remove("is-error", "is-success");
  userModal.classList.remove("is-hidden");
  userNomeInput.focus();
}

function closeModal() {
  userModal.classList.add("is-hidden");
  editingUserId = null;
}

logoutButton?.addEventListener("click", () => {
  clearSession();
  window.location.href = "login.html";
});

addButton?.addEventListener("click", () => openModal("create"));

editButton?.addEventListener("click", () => {
  const user = users.find((item) => item.id === selectedUserId);

  if (!user) {
    setListMessage("Selecione um usuario para editar.", "error");
    return;
  }

  openModal("edit", user);
});

deleteButton?.addEventListener("click", async () => {
  if (!selectedUserId) {
    setListMessage("Selecione um usuario para excluir.", "error");
    return;
  }

  const selectedUser = users.find((item) => item.id === selectedUserId);
  const confirmed = window.confirm(`Deseja realmente excluir "${selectedUser?.nome || "este usuario"}"?`);

  if (!confirmed) {
    return;
  }

  try {
    const result = await apiRequest(`/api/users/${selectedUserId}`, { method: "DELETE" });
    setSelection(null);
    setListMessage(result.message, "success");
    await loadUsers();
  } catch (error) {
    setListMessage(error.message, "error");
  }
});

printButton?.addEventListener("click", () => window.print());
closeModalButton?.addEventListener("click", closeModal);
cancelModalButton?.addEventListener("click", closeModal);

userModal?.addEventListener("click", (event) => {
  if (event.target === userModal) {
    closeModal();
  }
});

userForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const payload = {
    nome: userNomeInput.value.trim(),
    email: userEmailInput.value.trim().toLowerCase(),
    senha: userSenhaInput.value.trim()
  };

  showMessage(formMessage, editingUserId ? "Atualizando usuario..." : "Criando usuario...", "success");

  try {
    const result = await apiRequest(editingUserId ? `/api/users/${editingUserId}` : "/api/users", {
      method: editingUserId ? "PUT" : "POST",
      body: JSON.stringify(payload)
    });

    closeModal();
    setListMessage(result.message, "success");
    await loadUsers();
  } catch (error) {
    showMessage(formMessage, error.message, "error");
  }
});

loadSession().then(loadUsers);
