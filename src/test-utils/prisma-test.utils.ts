import { Prisma } from '@prisma/client';

export function createKnownRequestError(
  code: string,
  message = 'Prisma error',
) {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: 'test',
  });
}
