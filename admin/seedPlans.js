const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_PLANS = [
    {
        tier: 'STARTER',
        display_name: 'Starter',
        price_eur: 0,
        tokens_included: 1,
        can_export_pdf: false,
        features_list: [
            '1 scanare / audit inclus',
            'Verificare directive UE de bază',
            'Recomandări esențiale de conformitate'
        ],
        is_active: true
    },
    {
        tier: 'BUSINESS_PRO',
        display_name: 'Business Pro',
        price_eur: 49,
        tokens_included: 25,
        can_export_pdf: true,
        features_list: [
            '25 scanări / credite incluse',
            'Export rapoarte PDF oficiale',
            'Gestionare dosare tehnice și componente'
        ],
        is_active: true
    },
    {
        tier: 'ENTERPRISE',
        display_name: 'Enterprise',
        price_eur: 149,
        tokens_included: 150,
        can_export_pdf: true,
        features_list: [
            'Volum extins de scanări și audituri',
            'Export PDF nelimitat și rapoarte detaliate',
            'Suport prioritar și facilități dedicate'
        ],
        is_active: true
    }
];

async function main() {
    for (const plan of DEFAULT_PLANS) {
        await prisma.subscription_plans_config.upsert({
            where: { tier: plan.tier },
            update: {
                display_name: plan.display_name,
                price_eur: plan.price_eur,
                tokens_included: plan.tokens_included,
                can_export_pdf: plan.can_export_pdf,
                features_list: plan.features_list,
                is_active: plan.is_active
            },
            create: plan
        });
    }
    console.log('Pachetele STARTER, BUSINESS_PRO și ENTERPRISE au fost sincronizate cu succes.');
}

main()
    .catch((err) => {
        console.error(err);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });