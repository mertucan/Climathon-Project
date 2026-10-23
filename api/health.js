import { health } from '../lib/handlers.js';

export default function handler(req, res) {
  const { status, json } = health();
  res.status(status).json(json);
}
