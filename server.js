const { verifyToken } = require('@clerk/clerk-sdk-node');
require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const cookieParser = require('cookie-parser');

const app = express();
const PORT = process.env.PORT || 3000;
const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Serve static files first
app.use(express.static(path.join(__dirname)));

// Middleware
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(cookieParser());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Authentication Middleware
const authenticateToken = async (req, res, next) => {
  const sessionToken = req.headers.authorization?.split(' ')[1] || req.cookies.__session;
  if (!sessionToken) return res.status(401).json({ error: 'Please login to continue' });

  try {
    const session = await verifyToken(sessionToken, {
      secretKey: CLERK_SECRET_KEY,
    });
    req.user = { id: session.sub }; // session.sub contains the userId in JWT
    next();
  } catch (err) {
    console.error('Clerk session verification error:', err);
    return res.status(403).json({ error: 'Session expired, please login again' });
  }
};

// API Endpoints

// Get all user albums
app.get('/api/albums', authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from('albums')
    .select('*')
    .eq('user_id', req.user.id);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Add a new album for user
app.post('/api/albums', authenticateToken, async (req, res) => {
  const { name } = req.body;
  const { data, error } = await supabase
    .from('albums')
    .insert([{ user_id: req.user.id, name }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get all non-deleted photos for user
app.get('/api/photos', authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('is_deleted', false);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get all deleted photos for user (Trash Bin)
app.get('/api/trash', authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from('photos')
    .select('*')
    .eq('user_id', req.user.id)
    .eq('is_deleted', true);

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Add a photo for user
app.post('/api/photos', authenticateToken, async (req, res) => {
  const { src, category, favorite, title, story, color, fontColor } = req.body;
  const { data, error } = await supabase
    .from('photos')
    .insert([{
      user_id: req.user.id,
      src,
      category,
      favorite: !!favorite,
      title,
      story,
      color,
      font_color: fontColor,
      is_deleted: false
    }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Update a photo (User must own it)
app.put('/api/photos/:id', authenticateToken, async (req, res) => {
  const { title, story, color, fontColor, favorite } = req.body;
  const { data, error } = await supabase
    .from('photos')
    .update({
      title,
      story,
      color,
      font_color: fontColor,
      favorite: !!favorite
    })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Photo not found or unauthorized' });
  res.json({ message: 'Updated successfully' });
});

// Bulk update colors for user photos
app.put('/api/photos/bulk/colors', authenticateToken, async (req, res) => {
  const { color, fontColor } = req.body;
  const { data, error } = await supabase
    .from('photos')
    .update({ color, font_color: fontColor })
    .eq('user_id', req.user.id)
    .eq('is_deleted', false)
    .select('*');

  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: `Successfully updated ${data.length} photos` });
});

// Soft Delete a photo
app.delete('/api/photos/:id', authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from('photos')
    .update({ is_deleted: true })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Photo not found or unauthorized' });
  res.json({ message: 'Moved to trash' });
});

// Restore a photo
app.post('/api/photos/:id/restore', authenticateToken, async (req, res) => {
  const { data, error } = await supabase
    .from('photos')
    .update({ is_deleted: false })
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Photo not found or unauthorized' });
  res.json({ message: 'Restored successfully' });
});

// Permanently Delete a photo
app.delete('/api/photos/:id/permanent', authenticateToken, async (req, res) => {
  const { error, data } = await supabase
    .from('photos')
    .delete()
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select();

  if (error) return res.status(500).json({ error: error.message });
  if (!data || data.length === 0) return res.status(404).json({ error: 'Photo not found or unauthorized' });
  res.json({ message: 'Permanently deleted' });
});

// Serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index3.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
