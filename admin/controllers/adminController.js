const adminService = require('../services/adminService');

class AdminController {
    // Afișare Dashboard
   async getDashboard(req, res) {
    try {
        const accountsCount = await prisma.accounts.count();
        const standardsCount = await prisma.standards.count();
        const rulesCount = await prisma.compliance_rules.count();
        
        res.render('admin/admin/dashboard', { 
            admin: req.session.admin,
            accountsCount, 
            standardsCount, 
            rulesCount 
        });
    } catch (error) {
        console.error(error);
        res.status(500).send("Eroare la server.");
    }
}

    // Pagina Standarde (CRUD)
    async renderStandards(req, res) {
        const standards = await adminService.getAllStandards();
        res.render('admin/standards', { standards });
    }

    async createStandard(req, res) {
        try {
            await adminService.createStandard(req.body);
            res.redirect('/admin/standards');
        } catch (error) {
            res.status(400).send("Eroare la crearea standardului.");
        }
    }

    async deleteStandard(req, res) {
        try {
            await adminService.deleteStandard(req.params.id);
            res.redirect('/admin/standards');
        } catch (error) {
            res.status(400).send("Eroare la ștergerea standardului.");
        }
    }

    // Pagina Regulilor de Conformitate (FK)
    async renderRules(req, res) {
        const rules = await adminService.getAllRules();
        const standards = await adminService.getAllStandards();
        res.render('admin/rules', { rules, standards });
    }

    async createRule(req, res) {
        try {
            await adminService.createRule(req.body);
            res.redirect('/admin/rules');
        } catch (error) {
            res.status(400).send("Eroare la adăugarea regulii.");
        }
    }

    async deleteRule(req, res) {
        try {
            await adminService.deleteRule(req.params.id);
            res.redirect('/admin/rules');
        } catch (error) {
            res.status(400).send("Eroare la ștergerea regulii.");
        }
    }
}

module.exports = new AdminController();