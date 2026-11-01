// backend/src/modules/employees/employees.routes.js

import { Router } from "express";

import {
  listEmployeesController,
  getEmployeeController,
  createEmployeeController,
  updateEmployeeController,
  deleteEmployeeController,
} from "./employees.controller.js";

import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

// Every endpoint requires a valid authenticated user.
router.use(authenticate);

// GET /api/v1/employees
router.get("/", listEmployeesController);

// GET /api/v1/employees/:id
router.get("/:id", getEmployeeController);

// POST /api/v1/employees
router.post("/", createEmployeeController);

// PATCH /api/v1/employees/:id
router.patch("/:id", updateEmployeeController);

// DELETE /api/v1/employees/:id
router.delete("/:id", deleteEmployeeController);

export default router;