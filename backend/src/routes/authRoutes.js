import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { randomBytes } from "node:crypto";

const router = express.Router();

const DEMO_LOGIN_ENABLED =
  process.env.NODE_ENV === "development" &&
  process.env.DEMO_LOGIN_ENABLED === "true";

const demoUsers = [
  {
    name: "Local Admin",
    email: process.env.DEMO_ADMIN_EMAIL,
    password: process.env.DEMO_ADMIN_PASSWORD,
    role: "admin",
  },
  {
    name: "Local Employee",
    email: process.env.DEMO_EMPLOYEE_EMAIL,
    password: process.env.DEMO_EMPLOYEE_PASSWORD,
    role: "employee",
  },
  {
    name: "Local Manager",
    email: process.env.DEMO_MANAGER_EMAIL,
    password: process.env.DEMO_MANAGER_PASSWORD,
    role: "manager",
  },
  {
    name: "Local Finance",
    email: process.env.DEMO_FINANCE_EMAIL,
    password: process.env.DEMO_FINANCE_PASSWORD,
    role: "finance",
  },
]
  .filter((user) => user.email && user.password)
  .map((user) => ({
    ...user,
    email: user.email.trim().toLowerCase(),
  }));

// Hash configured passwords once when this module loads.
const usersWithPasswordHashesPromise = Promise.all(
  demoUsers.map(async ({ password, ...user }) => ({
    ...user,
    passwordHash: await bcrypt.hash(password, 12),
  }))
);

// A dummy hash keeps unknown-email attempts on the same comparison path.
const dummyPasswordHashPromise = bcrypt.hash(
  randomBytes(32).toString("hex"),
  12
);

function getJwtSecret() {
  const secret = process.env.JWT_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET must be set to at least 32 characters.");
  }

  return secret;
}

router.post("/login", async (req, res) => {
  if (!DEMO_LOGIN_ENABLED) {
    return res.status(403).json({
      message: "Demo login is disabled. Enable it only for local development.",
    });
  }

  const email =
    typeof req.body?.email === "string"
      ? req.body.email.trim().toLowerCase()
      : "";

  const password =
    typeof req.body?.password === "string" ? req.body.password : "";

  if (!email || !password) {
    return res.status(400).json({
      message: "Email and password are required.",
    });
  }

  if (email.length > 254 || password.length > 200) {
    return res.status(400).json({
      message: "Email or password is too long.",
    });
  }

  const users = await usersWithPasswordHashesPromise;
  const user = users.find((item) => item.email === email);

  const passwordHash =
    user?.passwordHash ?? (await dummyPasswordHashPromise);

  const passwordMatches = await bcrypt.compare(password, passwordHash);

  if (!user || !passwordMatches) {
    return res.status(401).json({
      message: "Invalid email or password.",
    });
  }

  let accessToken;

  try {
    accessToken = jwt.sign(
      {
        sub: user.email,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      getJwtSecret(),
      {
        expiresIn: "1h",
        issuer: "etdox-api",
        audience: "etdox-app",
      }
    );
  } catch (error) {
    console.error("[Auth] Could not create login token:", error.message);

    return res.status(500).json({
      message: "Unable to create a login session. Check the API configuration.",
    });
  }

  return res.json({
    data: {
      accessToken,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    },
  });
});

export function requireAuth(req, res, next) {
  const authorization = req.headers.authorization || "";
  const [scheme, token] = authorization.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({
      message: "Authentication required.",
    });
  }

  try {
    req.user = jwt.verify(token, getJwtSecret(), {
      issuer: "etdox-api",
      audience: "etdox-app",
    });

    return next();
  } catch {
    return res.status(401).json({
      message: "Invalid or expired token.",
    });
  }
}

router.get("/me", requireAuth, (req, res) => {
  res.json({
    user: {
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
    },
  });
});

export const authRouter = router;
export default router;