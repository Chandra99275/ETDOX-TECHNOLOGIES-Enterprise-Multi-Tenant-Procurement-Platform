import { app } from './app';
import { env } from './config/env';
app.listen(env.port, () => console.log(`ETDOX API on :${env.port}`));
