require('dotenv').config();
const express = require('express');
const { pool } = require('./config/db');
const pollRoutes = require('./routes/pollroute');
const errorHandler = require('./middlewares/errorHandler');
const AppError = require('./utils/AppError');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/health', (req, res) => {
res.status(200).json({ status: 'ok' });
});

app.get('/ping', (req, res) => {
res.status(200).json({ message: 'pong' });
});

app.use('/polls', pollRoutes);

app.use((req, res, next) => {
next(new AppError(404, `Route ${req.method} ${req.originalUrl} not found`));
});

app.use(errorHandler); 

async function start() {
try {
await pool.query('SELECT 1'); 
console.log('Connected to PostgreSQL');
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
} catch (err) {
console.error('Failed to connect to PostgreSQL:', err.message);
process.exit(1);
}
}

start();