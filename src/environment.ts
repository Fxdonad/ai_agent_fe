import * as dotenv from 'dotenv';
import convict from 'convict'; // Đổi từ import * as convict thành import convict

dotenv.config();

interface ConfigSchema {
  brave_search_api_key: string;
}

const env = convict<ConfigSchema>({
  brave_search_api_key: {
    format: String,
    default: '',
    env: 'BRAVE_SEARCH_API_KEY',
    doc: 'Brave Search API Key',
  },
});

// Kiểm tra cấu hình
env.validate({ allowed: 'strict' });

export default env;