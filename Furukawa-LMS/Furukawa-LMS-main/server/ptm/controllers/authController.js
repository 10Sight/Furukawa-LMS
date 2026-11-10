import db from '../db/database.js';

export function login(req, res) {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, message: 'Username and password are required' });
    }

    const trimmedUser = String(username).trim();
    const trimmedPass = String(password).trim();

    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(trimmedUser);

    if (!user || user.password !== trimmedPass) {
      return res.status(401).json({ success: false, message: 'Invalid username or password' });
    }

    // Return user info
    return res.json({
      success: true,
      message: 'Login successful',
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        employeeId: user.employee_id,
        department: user.department,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export function getCurrentUser(req, res) {
  try {
    // In a demo/lightweight environment, check query/header or default to primary user
    const username = req.query.username || 'Shivampanday';
    const user = db.prepare('SELECT * FROM users WHERE LOWER(username) = LOWER(?)').get(username);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        employeeId: user.employee_id,
        department: user.department,
        role: user.role,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
}

export function logout(req, res) {
  return res.json({ success: true, message: 'Logged out successfully' });
}

