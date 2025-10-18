require('dotenv').config();

module.exports = {
  app: {
    port: process.env.PORT || 4000,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'change-me',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
    saltRounds: Number(process.env.BCRYPT_SALT_ROUNDS) || 10,
  },
};
