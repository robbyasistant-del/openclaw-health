const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  await prisma.backupRun.update({
    where: { id: 'cmnxqyct00000ujokvpucnpzt' },
    data: {
      status: 'failed',
      finishedAt: new Date(),
      error: 'Timeout excedido esperando confirmación del agente LLM (más de 30 min).',
    },
  });
  console.log('Run updated');
  await prisma.$disconnect();
})();
