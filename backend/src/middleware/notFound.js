
export function notFound(req, res) {
  return res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.path}`,
    requestId: req.requestId ?? null,
  });
}

export default notFound;
