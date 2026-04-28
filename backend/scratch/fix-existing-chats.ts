import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration of existing chat rooms...');
  
  // Find all chat rooms that have at least one message
  const chatRoomsWithMessages = await prisma.chatRoom.findMany({
    where: {
      messages: {
        some: {}
      }
    }
  });

  console.log(`Found ${chatRoomsWithMessages.length} chat rooms with messages.`);

  for (const room of chatRoomsWithMessages) {
    await prisma.chatRoom.update({
      where: { id: room.id },
      data: { status: 'ACCEPTED' }
    });
  }

  console.log('Successfully updated existing chat rooms to ACCEPTED.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
