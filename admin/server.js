require('dotenv').config();
const express = require('express');
const path = require('path');
const methodOverride = require('method-override');
const session = require('express-session');

const app = express();

// Configurare EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));

// Configurare sesiuni
app.use(session({
    secret: process.env.SESSION_SECRET || 'eucheck_admin_secret_key',
    resave: false,
    saveUninitialized: false
}));

// Redirecționări utile pentru linkuri vechi
app.get('/Admin', (req, res) => {
    res.redirect('/admin/dashboard');
});

app.get('/Accounts', (req, res) => {
    res.redirect('/admin/accounts');
});

app.get('/Accounts/Edit/:id', (req, res) => {
    res.redirect(`/admin/accounts/${req.params.id}/edit`);
});

// Rute Admin
const adminRoutes = require('./routes/adminRoutes');
app.use('/admin', adminRoutes);

// Ruta principală redirecționează spre login
app.get('/', (req, res) => {
    res.redirect('/admin/login');
});

// Fallback 404 lizibil
app.use((req, res) => {
    res.status(404).send(`Ruta nu a fost găsită: ${req.method} ${req.originalUrl}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serverul Admin rulează pe http://localhost:${PORT}/admin/login`);
});