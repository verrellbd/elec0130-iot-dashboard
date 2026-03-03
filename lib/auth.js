// Static users — change passwords before deploying to production!
const USERS = {
  admin: {
    password: "admin123",
    role: "admin",
    name: "Admin",
  },
  viewer: {
    password: "viewer123",
    role: "viewer",
    name: "Viewer",
  },
};

export function authenticate(username, password) {
  const user = USERS[username];
  if (!user) return null;
  if (user.password !== password) return null;
  return { username, role: user.role, name: user.name };
}

export function isAdmin(user) {
  return user?.role === "admin";
}