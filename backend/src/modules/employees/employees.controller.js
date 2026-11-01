// backend/src/modules/employees/employees.controller.js

import {
  listEmployeesService,
  getEmployeeService,
  createEmployeeService,
  updateEmployeeService,
  deleteEmployeeService,
} from "./employees.service.js";

function handleError(res, error) {
  const statusCode = Number.isInteger(error.statusCode)
    ? error.statusCode
    : 500;

  if (statusCode >= 500) {
    console.error("[Employees]", error);
  }

  return res.status(statusCode).json({
    success: false,
    message:
      statusCode >= 500
        ? "An error occurred while processing the employee request."
        : error.message,
  });
}

export async function listEmployeesController(req, res) {
  try {
    const result = await listEmployeesService(req.user, req.query);

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function getEmployeeController(req, res) {
  try {
    const employee = await getEmployeeService(
      req.user,
      req.params.id,
    );

    return res.status(200).json({
      success: true,
      data: employee,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function createEmployeeController(req, res) {
  try {
    const employee = await createEmployeeService(
      req.user,
      req.body,
    );

    return res.status(201).json({
      success: true,
      message: "Employee created successfully.",
      data: employee,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function updateEmployeeController(req, res) {
  try {
    const employee = await updateEmployeeService(
      req.user,
      req.params.id,
      req.body,
    );

    return res.status(200).json({
      success: true,
      message: "Employee updated successfully.",
      data: employee,
    });
  } catch (error) {
    return handleError(res, error);
  }
}

export async function deleteEmployeeController(req, res) {
  try {
    const result = await deleteEmployeeService(
      req.user,
      req.params.id,
    );

    return res.status(200).json({
      success: true,
      ...result,
    });
  } catch (error) {
    return handleError(res, error);
  }
}