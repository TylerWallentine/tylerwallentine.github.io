const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const app = express();

app.use(cors());
app.use(express.json());

admin.initializeApp({
  credential: admin.credential.cert(require('./serviceAccountKey.json'))
});

const db = admin.firestore();

// Verify Firebase token middleware
async function verifyUser(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.split('Bearer ')[1];
  if (!token) return res.status(401).json({ error: 'Missing token' });
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    if (decoded.email !== 'wallentinetyler@gmail.com')
      return res.status(403).json({ error: 'Unauthorized' });
    req.user = decoded;
    next();
  } catch (err) {
    console.error(err);
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Example secure endpoint: create a project
app.post('/api/project', verifyUser, async (req, res) => {
  try {
    const project = req.body;
    await db.collection('projects').add(project);
    res.json({ message: 'Project saved successfully' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Failed to save project' });
  }
});

app.listen(8080, () => console.log('Server running on port 8080'));
