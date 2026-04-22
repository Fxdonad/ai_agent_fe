import * as dotenv from "dotenv";
import convict from "convict"; // Đổi từ import * as convict thành import convict

dotenv.config();

interface ConfigSchema {
  brave_search_api_key: string;
  agent_work_dir: string;
  main_work_space_dir: string;
  user_name: string;
  host_ip: string;
  host_port: number;
}

const env = convict<ConfigSchema>({
  brave_search_api_key: {
    format: String,
    default: "",
    env: "BRAVE_SEARCH_API_KEY",
    doc: "Brave Search API Key",
  },
  agent_work_dir: {
    format: String,
    default: "home/fxdonad/Fxdonad/Agent",
    env: "AGENT_WORK_DIR",
    doc: "Agent folder path working on local machine, used for file operations",
  },
  main_work_space_dir: {
    format: String,
    default: "home/fxdonad",
    env: "WORK_SPACE_DIR",
    doc: "Main workspace directory for the agent, used for file operations",
  },
  user_name: {
    format: String,
    default: "fxdonad",
    env: "USER_NAME",
    doc: "Username for the agent to operate with, used for file operations and command execution",
  },
  host_ip: {
    format: String,
    default: "127.0.0.1",
    env: "HOST_IP",
    doc: "Host IP address for the agent to bind or connect to",
  },
  host_port: {
    format: "port",
    default: 1235,
    env: "HOST_PORT",
    doc: "Host port for the agent to bind or connect to",
  },
});

// Kiểm tra cấu hình
env.validate({ allowed: "strict" });

export default env;
