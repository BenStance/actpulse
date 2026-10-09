import 'dotenv/config';
import * as bcrypt from 'bcryptjs';
import AppDataSource from '../../ormconfig';
import { validateNewPassword } from '../common/security/password';
import { UserRole } from '../common/enums/user-role.enum';
import { User } from '../modules/users/user.entity';

async function bootstrapAdmin() {
  await AppDataSource.initialize();
  try {
    const users = AppDataSource.getRepository(User);
    if (await users.exists({ where: { role: UserRole.ADMIN } })) {
      console.log('An Admin already exists; no changes made.');
      return;
    }
    const name = process.env.BOOTSTRAP_ADMIN_NAME?.trim();
    const email = process.env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;
    if (
      !name ||
      !email ||
      !password ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)
    ) {
      throw new Error(
        'Set valid BOOTSTRAP_ADMIN_NAME, BOOTSTRAP_ADMIN_EMAIL, and BOOTSTRAP_ADMIN_PASSWORD',
      );
    }
    validateNewPassword(password);
    if (await users.exists({ where: { email } })) {
      throw new Error('Bootstrap email is already in use; no changes made.');
    }
    await users.save(
      users.create({
        name,
        email,
        password: await bcrypt.hash(password, 12),
        role: UserRole.ADMIN,
        isActive: true,
        isActivated: true,
        tokenVersion: 0,
      }),
    );
    console.log('Admin account created.');
  } finally {
    await AppDataSource.destroy();
  }
}

void bootstrapAdmin().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
});
