import axios from 'axios'

// 默认走相对路径 /api：
// - dev 环境由 vite.config.ts 的 proxy 代理到 http://localhost:3000
// - 生产环境由 client/nginx.conf 代理到 server:3000
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || '/api'

const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 120000,
})

export default api
