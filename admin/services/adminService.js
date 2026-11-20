const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

class AdminService {
    // Numărătoare pentru dashboard
    async getCounts() {
        const standardsCount = await prisma.standards.count();
        const rulesCount = await prisma.compliance_rules.count();
        const accountsCount = await prisma.accounts.count();
        return { standardsCount, rulesCount, accountsCount };
    }

    // Gestiune Standarde
    async getAllStandards() {
        return await prisma.standards.findMany({ orderBy: { id: 'desc' } });
    }

    async createStandard(data) {
        return await prisma.standards.create({
            data: {
                code: data.code,
                title: data.title,
                category: parseInt(data.category),
                description: data.description,
                official_url: data.official_url
            }
        });
    }
}

module.exports = new AdminService();