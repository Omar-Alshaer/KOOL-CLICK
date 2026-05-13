import {
  adminCreateUser,
  adminDeleteUser,
  adminGetAuditLogs,
  adminListUsers,
  adminUpdateUserRole,
} from "./services/admin-service.js";
import {
  guardSuperAdminPage,
  mountAdminHeader,
  renderAdminMiniProfile,
} from "./admin-common.js";
import { escapeHtml } from "./utils/dom.js";
import { withButtonLoading } from "./utils/loading.js";
import {
  showConfirmPopup,
  showErrorPopup,
  showSuccessPopup,
} from "./utils/popup.js";
import { logError, logInfo } from "./utils/logger.js";

const state = {
  admin: null,
  users: [],
  auditLogs: [],
  editingUid: "",
};

function formatTime(value) {
  if (!value) return "-";
  if (typeof value.toDate === "function") return value.toDate().toLocaleString();
  if (value.seconds) return new Date(value.seconds * 1000).toLocaleString();
  return "-";
}

function formPayload(form) {
  const data = new FormData(form);
  return {
    targetUid: String(data.get("targetUid") || ""),
    role: String(data.get("role") || ""),
    displayName: String(data.get("displayName") || ""),
    email: String(data.get("email") || ""),
    phone: String(data.get("phone") || ""),
    password: String(data.get("password") || ""),
    restaurantId: String(data.get("restaurantId") || ""),
    restaurantName: String(data.get("restaurantName") || ""),
    username: String(data.get("username") || ""),
  };
}

function applyRoleFieldState(form) {
  const role = form?.querySelector("[name='role']")?.value || "";
  const needsRestaurant = role === "cashier" || role === "manager";
  const needsEmail = role === "clicker" || role === "admin";

  form?.querySelectorAll("[data-restaurant-field]").forEach((node) => {
    node.hidden = !needsRestaurant;
  });
  form?.querySelectorAll("[data-email-field]").forEach((node) => {
    node.hidden = !needsEmail;
  });
}

function renderUsers() {
  const host = document.getElementById("adminUsersList");
  if (!host) return;

  if (!state.users.length) {
    host.innerHTML = `<p class="kc-muted">No managed users found.</p>`;
    return;
  }

  host.innerHTML = `
    <div class="kc-table-wrap">
      <table class="kc-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Role</th>
            <th>Restaurant</th>
            <th>Status</th>
            <th>Created</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${state.users.map((user) => `
            <tr>
              <td>
                <strong>${escapeHtml(user.displayName || user.uid)}</strong>
                <div class="kc-muted">${escapeHtml(user.email || user.authEmail || user.phone || user.uid)}</div>
              </td>
              <td>${escapeHtml(user.role)}</td>
              <td>${escapeHtml(user.restaurantName || user.restaurantId || "-")}</td>
              <td>${user.disabled ? "Disabled" : "Active"}</td>
              <td>${escapeHtml(formatTime(user.createdAt))}</td>
              <td>
                <button class="kc-btn kc-btn-secondary" type="button" data-edit-user="${escapeHtml(user.uid)}">Edit</button>
                <button class="kc-btn kc-btn-danger" type="button" data-delete-user="${escapeHtml(user.uid)}">Delete</button>
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAuditLogs() {
  const host = document.getElementById("adminAuditList");
  if (!host) return;

  if (!state.auditLogs.length) {
    host.innerHTML = `<p class="kc-muted">No audit events found.</p>`;
    return;
  }

  host.innerHTML = state.auditLogs.map((log) => `
    <div class="kc-card kc-section-spaced-sm">
      <div class="kc-inline" style="justify-content: space-between; flex-wrap: wrap;">
        <strong>${escapeHtml(log.action)}</strong>
        <span class="kc-muted">${escapeHtml(formatTime(log.createdAt))}</span>
      </div>
      <div class="kc-muted">Admin: ${escapeHtml(log.adminUid)} | Target: ${escapeHtml(log.targetUid || "-")}</div>
      <div class="kc-muted">Status: ${escapeHtml(log.status || "success")}</div>
    </div>
  `).join("");
}

async function refreshSystemData() {
  const [users, auditLogs] = await Promise.all([
    adminListUsers(100),
    adminGetAuditLogs(50),
  ]);
  state.users = users;
  state.auditLogs = auditLogs;
  renderUsers();
  renderAuditLogs();
  logInfo("admin.system.loaded", { users: users.length, auditLogs: auditLogs.length });
}

function openRoleModal(user) {
  const modal = document.getElementById("roleModal");
  const form = document.getElementById("roleEditForm");
  if (!modal || !form || !user) return;

  state.editingUid = user.uid;
  form.targetUid.value = user.uid;
  form.displayName.value = user.displayName || "";
  form.role.value = user.role || "clicker";
  form.email.value = user.email || "";
  form.phone.value = user.phone || "";
  form.restaurantId.value = user.restaurantId || "";
  form.restaurantName.value = user.restaurantName || "";
  applyRoleFieldState(form);
  modal.hidden = false;
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  form.displayName.focus();
}

function closeRoleModal() {
  const modal = document.getElementById("roleModal");
  if (!modal) return;
  state.editingUid = "";
  modal.classList.remove("open");
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
}

function bindEvents() {
  const createForm = document.getElementById("createUserForm");
  const roleForm = document.getElementById("roleEditForm");

  createForm?.querySelector("[name='role']")?.addEventListener("change", () => applyRoleFieldState(createForm));
  roleForm?.querySelector("[name='role']")?.addEventListener("change", () => applyRoleFieldState(roleForm));
  applyRoleFieldState(createForm);
  applyRoleFieldState(roleForm);

  createForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = createForm.querySelector("button[type='submit']");
    await withButtonLoading(submitBtn, async () => {
      try {
        await adminCreateUser(formPayload(createForm));
        createForm.reset();
        applyRoleFieldState(createForm);
        await refreshSystemData();
        await showSuccessPopup("User created successfully.", "System Updated");
      } catch (error) {
        logError("admin.createUser.failure", error);
        await showErrorPopup(error.message || "Could not create user.", "Create User Failed");
      }
    }, "Creating...");
  });

  roleForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = roleForm.querySelector("button[type='submit']");
    await withButtonLoading(submitBtn, async () => {
      try {
        await adminUpdateUserRole(formPayload(roleForm));
        closeRoleModal();
        await refreshSystemData();
        await showSuccessPopup("User role updated successfully.", "System Updated");
      } catch (error) {
        logError("admin.updateRole.failure", error, { targetUid: state.editingUid });
        await showErrorPopup(error.message || "Could not update role.", "Role Update Failed");
      }
    }, "Saving...");
  });

  document.getElementById("adminUsersList")?.addEventListener("click", async (event) => {
    const editUid = event.target?.dataset?.editUser;
    const deleteUid = event.target?.dataset?.deleteUser;

    if (editUid) {
      openRoleModal(state.users.find((user) => user.uid === editUid));
      return;
    }

    if (!deleteUid) return;
    const target = state.users.find((user) => user.uid === deleteUid);
    const confirmed = await showConfirmPopup(
      `Delete ${target?.displayName || deleteUid}? This removes Firebase Auth access and role profiles.`,
      "Delete User",
      "Delete",
      "Cancel",
      { dangerous: true }
    );
    if (!confirmed) return;

    try {
      await adminDeleteUser(deleteUid);
      await refreshSystemData();
      await showSuccessPopup("User deleted successfully.", "System Updated");
    } catch (error) {
      logError("admin.deleteUser.failure", error, { targetUid: deleteUid });
      await showErrorPopup(error.message || "Could not delete user.", "Delete User Failed");
    }
  });

  document.getElementById("roleModalClose")?.addEventListener("click", closeRoleModal);
  document.getElementById("roleModalCancel")?.addEventListener("click", closeRoleModal);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeRoleModal();
  });

  document.getElementById("refreshAdminData")?.addEventListener("click", async (event) => {
    await withButtonLoading(event.currentTarget, refreshSystemData, "Refreshing...");
  });
}

async function init() {
  const session = await guardSuperAdminPage();
  if (!session) return;
  state.admin = session;

  mountAdminHeader({ active: "system" });
  renderAdminMiniProfile("adminMini", session.profile);
  bindEvents();
  await refreshSystemData();
}

init().catch(async (error) => {
  logError("admin.system.init.failure", error);
  await showErrorPopup(error.message || "Could not load system panel.", "System Error");
});
