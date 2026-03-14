const bcrypt = require('bcryptjs');
bcrypt.hash('1234', 10).then(res => console.log('HASH:', res));
