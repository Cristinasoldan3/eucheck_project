const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function logAdminActivity(req, { action_type, target_table, target_id = null, description }) {
    try {
        let adminId = req.session && req.session.admin ? req.session.admin.id : null;

        if (!adminId) {
            const fallbackAdmin = await prisma.accounts.findFirst({
                where: { is_admin: true },
                select: { id: true }
            });
            adminId = fallbackAdmin ? fallbackAdmin.id : null;
        }

        if (!adminId) return;

        await prisma.admin_activity_logs.create({
            data: {
                admin_account_id: adminId,
                action_type,
                target_table,
                target_id: target_id ? parseInt(target_id, 10) : null,
                description
            }
        });
    } catch (err) {
        console.error('Eroare la salvarea în jurnalul de audit:', err);
    }
}

// 0. Autentificare (Login / Logout)
router.get('/login', (req, res) => {
    res.render('admin/login', { error: null });
});

router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const adminUser = await prisma.accounts.findUnique({
            where: { email }
        });

        if (!adminUser || !adminUser.is_admin) {
            return res.render('admin/login', { error: 'Date invalide sau nu ai drepturi de administrator!' });
        }

        const isMatch = await bcrypt.compare(password, adminUser.password_hash);
        if (!isMatch) {
            return res.render('admin/login', { error: 'Parolă incorectă!' });
        }

        req.session.admin = { id: adminUser.id, email: adminUser.email };
        res.redirect('/admin/dashboard');
    } catch (err) {
        console.error(err);
        res.render('admin/login', { error: 'Eroare de server la autentificare.' });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/admin/login');
    });
});

// Dashboard-ul
router.get('/dashboard', async (req, res) => {
    try {
        const accountsCount = await prisma.accounts.count();
        const standardsCount = await prisma.standards.count();
        const rulesCount = await prisma.compliance_rules.count();

        res.render('admin/dashboard', {
            admin: req.session.admin,
            accountsCount,
            standardsCount,
            rulesCount
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la încărcarea datelor din baza de date.');
    }
});

// ==================== GESTIUNE CONTURI (ACCOUNTS) ====================

// 1. Listă conturi
router.get('/accounts', async (req, res) => {
    try {
        const accounts = await prisma.accounts.findMany({ orderBy: { id: 'desc' } });
        res.render('accounts/index', { accounts });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la server');
    }
});

// 2. Formular editare cont (înainte de /accounts/:id)
router.get('/accounts/:id/edit', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const account = await prisma.accounts.findUnique({
            where: { id }
        });
        if (!account) return res.status(404).send('Cont negăsit');

        res.render('accounts/edit', { account });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la server');
    }
});

// 3. Detalii cont
router.get('/accounts/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const account = await prisma.accounts.findUnique({
            where: { id }
        });
        if (!account) return res.status(404).send('Cont negăsit');

        res.render('accounts/details', { account });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la server');
    }
});

// 4. Actualizare cont (PUT)
router.put('/accounts/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const oldAccount = await prisma.accounts.findUnique({ where: { id } });
        if (!oldAccount) return res.status(404).send('Cont negăsit');

        const { email, full_name, company_name, vat_number, tier, tokens_balance } = req.body;
        const selectedTier = (tier || oldAccount.tier || 'STARTER').trim();
        const tierChanged = oldAccount.tier !== selectedTier;

        const planConfig = await prisma.subscription_plans_config.findUnique({
            where: { tier: selectedTier }
        }).catch(() => null);

        const hasExplicitTokens =
            req.body.tokens_balance !== undefined &&
            String(req.body.tokens_balance).trim() !== '';
        const parsedTokensInput = hasExplicitTokens ? parseInt(tokens_balance, 10) : NaN;

        let newTokens;
        if (tierChanged && planConfig && (!hasExplicitTokens || parsedTokensInput === oldAccount.tokens_balance)) {
            newTokens = planConfig.tokens_included;
        } else if (!Number.isNaN(parsedTokensInput)) {
            newTokens = parsedTokensInput;
        } else {
            newTokens = oldAccount.tokens_balance;
        }

        const newCanExportPdf =
            req.body.can_export_pdf !== undefined
                ? Boolean(req.body.can_export_pdf)
                : planConfig
                    ? Boolean(planConfig.can_export_pdf)
                    : Boolean(oldAccount.can_export_pdf);

        const newUnlimitedScans =
            req.body.has_unlimited_scans !== undefined
                ? Boolean(req.body.has_unlimited_scans)
                : selectedTier === 'ENTERPRISE'
                    ? true
                    : Boolean(oldAccount.has_unlimited_scans);

        const newActive =
            req.body.is_active !== undefined
                ? Boolean(req.body.is_active)
                : Boolean(oldAccount.is_active);

        await prisma.accounts.update({
            where: { id },
            data: {
                email,
                full_name: full_name || null,
                company_name: company_name || null,
                vat_number: vat_number || null,
                tier: selectedTier,
                tokens_balance: newTokens,
                can_export_pdf: newCanExportPdf,
                has_unlimited_scans: newUnlimitedScans,
                is_active: newActive
            }
        });

        const changes = [];
        if (oldAccount.tokens_balance !== newTokens) {
            changes.push(`tokeni: ${oldAccount.tokens_balance} -> ${newTokens}`);
        }
        if (oldAccount.tier !== selectedTier) {
            changes.push(`pachet: ${oldAccount.tier} -> ${selectedTier}`);
        }
        if (oldAccount.is_active !== newActive) {
            changes.push(`activ: ${oldAccount.is_active} -> ${newActive}`);
        }
        if (oldAccount.can_export_pdf !== newCanExportPdf) {
            changes.push(`export PDF: ${oldAccount.can_export_pdf} -> ${newCanExportPdf}`);
        }
        if (oldAccount.has_unlimited_scans !== newUnlimitedScans) {
            changes.push(`scanări nelimitate: ${oldAccount.has_unlimited_scans} -> ${newUnlimitedScans}`);
        }

        await logAdminActivity(req, {
            action_type: 'UPDATE_ACCOUNT',
            target_table: 'accounts',
            target_id: id,
            description: `Actualizare cont ${email}${changes.length ? ` (${changes.join(', ')})` : ''}`
        });

        res.redirect('/admin/accounts');
    } catch (error) {
        console.error(error);
        res.status(400).send('Eroare la actualizarea contului');
    }
});

// 5. Ștergere cont (DELETE)
router.delete('/accounts/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const existingAccount = await prisma.accounts.findUnique({ where: { id } });

        await prisma.accounts.delete({
            where: { id }
        });

        await logAdminActivity(req, {
            action_type: 'DELETE_ACCOUNT',
            target_table: 'accounts',
            target_id: id,
            description: `A șters contul #${id}${existingAccount && existingAccount.email ? ` (${existingAccount.email})` : ''}`
        });

        res.redirect('/admin/accounts');
    } catch (error) {
        console.error(error);
        res.status(400).send('Eroare la ștergerea contului');
    }
});

// ==================== GESTIUNE STANDARDE (STANDARDS) ====================

router.get('/standards', async (req, res) => {
    try {
        const standards = await prisma.standards.findMany({ orderBy: { id: 'desc' } });
        res.render('standards/index', { standards });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la server');
    }
});

router.get('/standards/create', (req, res) => {
    res.render('standards/create');
});

router.post('/Standards/Create', async (req, res) => {
    try {
        const { code, title, category, description, official_url, version } = req.body;
        const parsedCategory = parseInt(category, 10);

        const createdStandard = await prisma.standards.create({
            data: {
                code: code.trim(),
                title,
                category: Number.isNaN(parsedCategory) ? 1 : parsedCategory,
                description: description || category || null,
                official_url: official_url || null,
                version: parseInt(version, 10) || 1,
                is_active: Boolean(req.body.is_active)
            }
        });

        await logAdminActivity(req, {
            action_type: 'CREATE_STANDARD',
            target_table: 'standards',
            target_id: createdStandard.id,
            description: `A adăugat directiva ${createdStandard.code} - ${createdStandard.title}`
        });

        res.redirect('/admin/standards');
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).send('Există deja o directivă cu acest cod. Folosește un cod unic.');
        }
        console.error(error);
        res.status(400).send('Eroare la adăugarea directivei.');
    }
});

router.get('/Standards/Edit/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const standard = await prisma.standards.findUnique({ where: { id } });
        if (!standard) return res.status(404).send('Directivă negăsită');

        res.render('standards/edit', { standard });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la încărcarea formularului de editare.');
    }
});

router.post('/Standards/Edit/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const { code, title, category, description, official_url, version } = req.body;
        const parsedCategory = parseInt(category, 10);

        await prisma.standards.update({
            where: { id },
            data: {
                code,
                title,
                category: Number.isNaN(parsedCategory) ? 1 : parsedCategory,
                description: description || category || null,
                official_url: official_url || null,
                version: parseInt(version, 10) || 1,
                is_active: Boolean(req.body.is_active)
            }
        });

        await logAdminActivity(req, {
            action_type: 'UPDATE_STANDARD',
            target_table: 'standards',
            target_id: id,
            description: `A actualizat directiva #${id} (${code} - ${title})`
        });

        res.redirect('/admin/standards');
    } catch (error) {
        console.error(error);
        res.status(400).send('Eroare la actualizarea directivei.');
    }
});

router.get('/standards/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const standard = await prisma.standards.findUnique({
            where: { id }
        });
        if (!standard) return res.status(404).send('Standard negăsit');

        res.render('standards/details', { standard });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la server');
    }
});

router.put('/standards/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const { code, title, category, description } = req.body;
        await prisma.standards.update({
            where: { id },
            data: {
                code,
                title,
                category: parseInt(category, 10),
                description
            }
        });

        await logAdminActivity(req, {
            action_type: 'UPDATE_STANDARD',
            target_table: 'standards',
            target_id: id,
            description: `A actualizat directiva #${id} (${code} - ${title})`
        });

        res.redirect('/admin/standards');
    } catch (error) {
        console.error(error);
        res.status(400).send('Eroare la actualizare');
    }
});

router.get('/Standards/Details/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const standard = await prisma.standards.findUnique({ where: { id } });
        if (!standard) return res.status(404).send('Directivă negăsită');

        res.render('standards/details', { standard });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la încărcarea detaliilor.');
    }
});

router.post('/Standards/Delete/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        await prisma.standards.delete({
            where: { id }
        });

        await logAdminActivity(req, {
            action_type: 'DELETE_STANDARD',
            target_table: 'standards',
            target_id: id,
            description: `A șters directiva #${id}`
        });

        res.redirect('/admin/standards');
    } catch (error) {
        console.error(error);
        res.status(400).send('Eroare la ștergerea directivei.');
    }
});

// ==================== REGULI, PACHETE ȘI JURNAL ====================

router.get('/rules', async (req, res) => {
    try {
        const rules = await prisma.compliance_rules.findMany({
            include: { standards: true },
            orderBy: { id: 'desc' }
        }).catch(() => prisma.compliance_rules.findMany({ orderBy: { id: 'desc' } }));

        const standards = await prisma.standards.findMany({ orderBy: { id: 'desc' } }).catch(() => []);

        res.render('compliance/index', {
            rules,
            complianceRules: rules,
            standards,
            admin: req.session.admin
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la încărcarea regulilor de conformitate.');
    }
});

router.get('/plans', async (req, res) => {
    try {
        const orderMap = { STARTER: 1, BUSINESS_PRO: 2, PRO: 3, ENTERPRISE: 4 };
        const rawPlans = await prisma.subscription_plans_config.findMany({
            orderBy: { id: 'asc' }
        }).catch(() => []);

        const plans = rawPlans
            .map((p) => ({
                ...p,
                price_eur: Number(p.price_eur || 0)
            }))
            .sort((a, b) => (orderMap[a.tier] || 99) - (orderMap[b.tier] || 99));

        res.render('admin/plans/index', {
            plans,
            admin: req.session.admin
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la încărcarea pachetelor.');
    }
});

router.get('/plans/:id/edit', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const plan = await prisma.subscription_plans_config.findUnique({ where: { id } });
        if (!plan) return res.status(404).send('Pachet negăsit');

        res.render('admin/plans/edit', {
            plan: { ...plan, price_eur: Number(plan.price_eur || 0) },
            admin: req.session.admin
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la încărcarea formularului de editare pachet.');
    }
});

router.post('/plans/:id/edit', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const oldPlan = await prisma.subscription_plans_config.findUnique({ where: { id } });
        if (!oldPlan) return res.status(404).send('Pachet negăsit');

        const displayName = (req.body.display_name || oldPlan.display_name).trim();
        const priceEur = parseFloat(req.body.price_eur);
        const tokensIncluded = parseInt(req.body.tokens_included, 10);
        const canExportPdf = Boolean(req.body.can_export_pdf);
        const isActive = Boolean(req.body.is_active);

        const safePrice = Number.isNaN(priceEur) ? Number(oldPlan.price_eur || 0) : priceEur;
        const safeTokens = Number.isNaN(tokensIncluded) ? oldPlan.tokens_included : tokensIncluded;

        await prisma.subscription_plans_config.update({
            where: { id },
            data: {
                display_name: displayName,
                price_eur: safePrice,
                tokens_included: safeTokens,
                can_export_pdf: canExportPdf,
                is_active: isActive
            }
        });

        const changes = [];
        if (Number(oldPlan.price_eur) !== safePrice) {
            changes.push(`preț: ${Number(oldPlan.price_eur)} -> ${safePrice} EUR`);
        }
        if (oldPlan.tokens_included !== safeTokens) {
            changes.push(`tokeni: ${oldPlan.tokens_included} -> ${safeTokens}`);
        }
        if (oldPlan.can_export_pdf !== canExportPdf) {
            changes.push(`PDF: ${oldPlan.can_export_pdf} -> ${canExportPdf}`);
        }
        if (oldPlan.is_active !== isActive) {
            changes.push(`activ: ${oldPlan.is_active} -> ${isActive}`);
        }

        await logAdminActivity(req, {
            action_type: 'UPDATE_PLAN',
            target_table: 'subscription_plans_config',
            target_id: id,
            description: `Actualizare pachet ${oldPlan.tier} (${displayName})${changes.length ? ` [${changes.join(', ')}]` : ''}`
        });

        res.redirect('/admin/plans');
    } catch (error) {
        console.error(error);
        res.status(400).send('Eroare la actualizarea pachetului.');
    }
});

router.get('/logs', async (req, res) => {
    try {
        const rawLogs = await prisma.admin_activity_logs.findMany({
            include: { accounts: true },
            orderBy: { created_at: 'desc' }
        }).catch(() => []);

        const formatLocalDateISO = (dt) => {
            if (!dt) return '';
            const d = new Date(dt);
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'Europe/Bucharest',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).formatToParts(d);
            const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
            return `${map.year}-${map.month}-${map.day}`;
        };

        const mappedLogs = rawLogs.map((item) => ({
            id: item.id,
            action: item.action_type || 'ACȚIUNE',
            user: (item.accounts && item.accounts.email) || (req.session && req.session.admin && req.session.admin.email) || 'admin.eucheck@gmail.com',
            details: item.description || `${item.target_table || 'Sistem'}${item.target_id ? ` #${item.target_id}` : ''}`,
            timestamp: item.created_at ? new Date(item.created_at).toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' }) : '-',
            dateISO: formatLocalDateISO(item.created_at)
        }));

        res.render('admin/logs/index', {
            adminLogs: mappedLogs,
            logs: mappedLogs,
            admin: req.session ? req.session.admin : null
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la încărcarea jurnalului.');
    }
});

// Formular creare regulă conformitate
router.get('/rules/create', async (req, res) => {
    try {
        const standards = await prisma.standards.findMany({ orderBy: { id: 'desc' } }).catch(() => []);
        res.render('compliance/create', { standards, admin: req.session.admin });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la încărcarea formularului de regulă.');
    }
});

// Salvare regulă nouă
router.post('/rules/create', async (req, res) => {
    try {
        const {
            clause_reference,
            clause,
            article_code,
            title,
            name,
            standard_id,
            weight,
            score_weight,
            recommendation,
            keywords
        } = req.body;

        const parsedStandardId = parseInt(standard_id, 10);
        if (Number.isNaN(parsedStandardId)) {
            return res.status(400).send('Selectează un standard valid.');
        }

        const parsedWeight = parseInt(weight ?? score_weight, 10);
        const resolvedClauseRef = (clause_reference || clause || article_code || '').trim();
        const resolvedTitle = (title || name || '').trim();

        const parsedKeywords = Array.isArray(keywords)
            ? keywords.map((k) => String(k).trim()).filter(Boolean)
            : typeof keywords === 'string' && keywords.trim()
                ? keywords.split(',').map((k) => k.trim()).filter(Boolean)
                : [];

        const createdRule = await prisma.compliance_rules.create({
            data: {
                standard_id: parsedStandardId,
                clause_reference: resolvedClauseRef,
                title: resolvedTitle,
                keywords: parsedKeywords,
                weight: Number.isNaN(parsedWeight) ? 1 : parsedWeight,
                is_mandatory: Boolean(req.body.is_mandatory),
                recommendation: recommendation && recommendation.trim() ? recommendation.trim() : null,
                is_active: true
            }
        });

        await logAdminActivity(req, {
            action_type: 'CREATE_RULE',
            target_table: 'compliance_rules',
            target_id: createdRule.id,
            description: `A adăugat regula "${resolvedTitle}" (${resolvedClauseRef})`
        });

        res.redirect('/admin/rules');
    } catch (error) {
        console.error(error);
        res.status(400).send('Eroare la salvarea regulii de conformitate: ' + error.message);
    }
});

// Formular editare regulă conformitate
router.get('/rules/:id/edit', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const rule = await prisma.compliance_rules.findUnique({ where: { id } });
        if (!rule) return res.status(404).send('Regulă negăsită');

        const standards = await prisma.standards.findMany({ orderBy: { id: 'desc' } }).catch(() => []);
        res.render('compliance/edit', { rule, standards, admin: req.session.admin });
    } catch (error) {
        console.error(error);
        res.status(500).send('Eroare la încărcarea formularului de editare.');
    }
});

// Actualizare regulă conformitate
router.post('/rules/:id/edit', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        const {
            clause_reference,
            clause,
            article_code,
            title,
            name,
            standard_id,
            weight,
            score_weight,
            recommendation,
            keywords
        } = req.body;

        const parsedStandardId = parseInt(standard_id, 10);
        if (Number.isNaN(parsedStandardId)) {
            return res.status(400).send('Selectează un standard valid.');
        }

        const parsedWeight = parseInt(weight ?? score_weight, 10);
        const resolvedClauseRef = (clause_reference || clause || article_code || '').trim();
        const resolvedTitle = (title || name || '').trim();

        const parsedKeywords = Array.isArray(keywords)
            ? keywords.map((k) => String(k).trim()).filter(Boolean)
            : typeof keywords === 'string' && keywords.trim()
                ? keywords.split(',').map((k) => k.trim()).filter(Boolean)
                : [];

        await prisma.compliance_rules.update({
            where: { id },
            data: {
                standard_id: parsedStandardId,
                clause_reference: resolvedClauseRef,
                title: resolvedTitle,
                keywords: parsedKeywords,
                weight: Number.isNaN(parsedWeight) ? 1 : parsedWeight,
                is_mandatory: Boolean(req.body.is_mandatory),
                recommendation: recommendation && recommendation.trim() ? recommendation.trim() : null
            }
        });

        await logAdminActivity(req, {
            action_type: 'UPDATE_RULE',
            target_table: 'compliance_rules',
            target_id: id,
            description: `A modificat regula #${id} "${resolvedTitle}" (${resolvedClauseRef})`
        });

        res.redirect('/admin/rules');
    } catch (error) {
        console.error(error);
        res.status(400).send('Eroare la actualizarea regulii: ' + error.message);
    }
});

// Ștergere regulă conformitate (DELETE via _method=DELETE)
router.delete('/rules/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        await prisma.compliance_rules.delete({ where: { id } });

        await logAdminActivity(req, {
            action_type: 'DELETE_RULE',
            target_table: 'compliance_rules',
            target_id: id,
            description: `A șters regula de conformitate #${id}`
        });

        res.redirect('/admin/rules');
    } catch (error) {
        console.error(error);
        res.status(400).send('Eroare la ștergerea regulii.');
    }
});

// Ștergere regulă conformitate (fallback POST)
router.post('/rules/:id/delete', async (req, res) => {
    try {
        const id = parseInt(req.params.id, 10);
        if (Number.isNaN(id)) return res.status(400).send('ID invalid');

        await prisma.compliance_rules.delete({ where: { id } });

        await logAdminActivity(req, {
            action_type: 'DELETE_RULE',
            target_table: 'compliance_rules',
            target_id: id,
            description: `A șters regula de conformitate #${id}`
        });

        res.redirect('/admin/rules');
    } catch (error) {
        console.error(error);
        res.status(400).send('Eroare la ștergerea regulii.');
    }
});

module.exports = router;