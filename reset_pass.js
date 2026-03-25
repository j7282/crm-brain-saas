const bcrypt = require('bcryptjs');
const Datastore = require('@seald-io/nedb');
const path = require('path');

const dbDir = path.join(__dirname, 'ai-brain-backend/data');
const usersDb = new Datastore({ filename: path.join(dbDir, 'users.db'), autoload: true });

async function reset() {
    const hashedPassword = await bcrypt.hash('darwin123', 10);
    usersDb.update({ email: 'verify@test.com' }, { $set: { password: hashedPassword } }, {}, (err, num) => {
        if (err) console.error(err);
        else console.log('Password reset to: darwin123');
        process.exit();
    });
}
reset();
