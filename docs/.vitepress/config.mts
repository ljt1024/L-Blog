import { defineConfig } from 'vitepress'

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'zh-CN',
  title: "l-blog",
  description: "前端开发、AI 与工程实践学习博客",
  appearance: true,
  lastUpdated: true,
  markdown: {
    theme: {
      light: 'github-light',
      dark: 'github-dark'
    }
  },
  themeConfig: {
    search: {
      provider: 'local',
      options: {
        detailedView: false
      }
    },
    outline: { level: [2, 3], label: '文章目录' },
    docFooter: {
      prev: '上一篇',
      next: '下一篇'
    },
    sidebarMenuLabel: '导航菜单',
    returnToTopLabel: '返回顶部',
    darkModeSwitchLabel: '主题模式',
    lightModeSwitchTitle: '切换到浅色主题',
    darkModeSwitchTitle: '切换到深色主题',
    // https://vitepress.dev/reference/default-theme-config
    nav: [
      { text: '首页', link: '/' },
      { text: '学习记录', link: '/study/index', activeMatch: `^/study/`, },
      { text: '文章', link: '/articles' },
      { text: 'AI 工具', link: 'http://118.31.167.0:3000/ai', target: '_blank' },
    ],
    sidebar: {
      '/study/': [
        {
            text: '前端',
            items: [
              {
                text: 'HTML相关',
                items: [
                  { text: 'HTML基础', link: '/study/front-end/html-basic' },
                  { text: 'HTML进阶', link: '/study/front-end/html-advanced' }
                ]
              },
              {
                text: 'CSS相关',
                items: [
                  { text: 'CSS基础', link: '/study/front-end/css-basic' },
                  { text: 'CSS进阶', link: '/study/front-end/css-advanced' }
                ]
              },
              {
                text: 'JavaScript相关',
                items: [
                  { text: 'JavaScript基础', link: '/study/front-end/js-basics' },
                  { text: 'JavaScript进阶', link: '/study/front-end/js-advanced' },
                  // { text: 'LeetCode轮转数组', link: '/study/front-end/leetcode-rotate-array' },
                  // { text: '算法题解集锦', link: '/study/front-end/algorithm-solutions' },
                  { text: 'Vue.js基础', link: '/study/front-end/vue-intro' },
                  { text: 'Vue进阶', link: '/study/front-end/vue-advanced' },
                  { text: 'React基础', link: '/study/front-end/react-basics' },
                  { text: 'React进阶', link: '/study/front-end/react-advanced' },
                  { text: 'TypeScript', link: '/study/front-end/typescript-advanced' },
                ]
              },
              {
                text: '跨端',
                items: [
                  { text: 'Taro', link: '/study/front-end/taro-advanced' },
                  { text: 'UniApp', link: '/study/front-end/uniapp-advanced' },
                  { text: 'React Native', link: '/study/front-end/react-native-advanced' }
                ]
              }
            ]
          },
        {
              text: '后端',
              items: [
                {
                  text: 'Node.js',
                  items: [
                    { text: 'Node.js基础', link: '/study/back-end/nodejs-basics' },
                    { text: 'Express', link: '/study/back-end/express-advanced' },
                    { text: 'Node.js项目PM2部署', link: '/study/back-end/nodejs-pm2-deployment' }
                  ]
                },
                {
                  text: 'Go语言',
                  items: [
                    { text: 'Go语言基础', link: '/study/back-end/go-basics' },
                    { text: 'Go语言进阶', link: '/study/back-end/go-advanced' },
                    { text: 'Gin框架入门指南', link: '/study/back-end/gin-guide' },
                    { text: 'Gin框架进阶', link: '/study/back-end/gin-advanced' },
                    { text: 'GORM', link: '/study/back-end/gorm-guide' }
                  ]
                },
                {
                  text: 'Nginx',
                  items: [
                    { text: 'Nginx', link: '/study/back-end/nginx-advanced' }
                  ]
                },
                {
                  text: '数据库',
                  items: [
                    { text: 'MySQL', link: '/study/back-end/mysql-basics' },
                    { text: 'MongoDB', link: '/study/back-end/mongodb-advanced' },
                    { text: 'Redis', link: '/study/back-end/redis-advanced' }
                  ]
                }
              ]
            },
        {
          text: '工具与部署',
          items: [
            {
              text: '开发工具',
              items: [
                { text: 'Git使用指南', link: '/study/tools-deploy/git-guide' }
              ]
            },
            {
              text: '部署工具',
              items: [
                { text: 'Docker容器化部署指南', link: '/study/tools-deploy/docker-guide' },
                { text: 'Jeikens', link: '/study/tools-deploy/jeikens-guide' }
              ]
            }
          ]
        }
      ],
      // '/study/': [
      //   {
      //     text: '前端',
      //     items: [
      //       {
      //         text: 'HTML相关',
      //         items: [
      //           { text: 'HTML基础', link: '/study/front-end/html-basic' }
      //         ]
      //       },
      //       {
      //         text: 'CSS相关',
      //         items: [
      //           { text: 'CSS基础', link: '/study/front-end/css-basic' }
      //         ]
      //       },
      //       {
      //         text: 'JavaScript相关',
      //         items: [
      //           { text: 'JavaScript基础', link: '/study/front-end/js-basics' },
      //           { text: 'LeetCode轮转数组', link: '/study/front-end/leetcode-rotate-array' },
      //           { text: '算法题解集锦', link: '/study/front-end/algorithm-solutions' },
      //           { text: 'Vue.js入门指南', link: '/study/front-end/vue-intro' },
      //           { text: 'React基础入门', link: '/study/front-end/react-basics' }
      //         ]
      //       }
      //     ]
      //   },
      //   {
      //     text: '后端',
      //     items: [
      //       {
      //         text: 'Node.js',
      //         items: [
      //           { text: 'Node.js基础', link: '/study/back-end/nodejs-basics' }
      //         ]
      //       },
      //       {
      //         text: '数据库',
      //         items: [
      //           { text: 'MySQL基础教程', link: '/study/back-end/mysql-basics' }
      //         ]
      //       }
      //     ]
      //   },
      //   {
      //     text: '工具与部署',
      //     items: [
      //       {
      //         text: '开发工具',
      //         items: [
      //           { text: 'Git使用指南', link: '/study/tools-deploy/git-guide' }
      //         ]
      //       },
      //       {
      //         text: '部署工具',
      //         items: [
      //           { text: 'Docker容器化部署指南', link: '/study/tools-deploy/docker-guide' }
      //         ]
      //       }
      //     ]
      //   }
      // ],
      // '/front-end': [
      //   {
      //     text: '前端',
      //     items: [
      //       {
      //         text: 'HTML相关',
      //         items: [
      //           { text: 'HTML基础', link: '/study/front-end/html-basic' }
      //         ]
      //       },
      //       {
      //         text: 'CSS相关',
      //         items: [
      //           { text: 'CSS基础', link: '/study/front-end/css-basic' }
      //         ]
      //       },
      //       {
      //         text: 'JavaScript相关',
      //         items: [
      //           { text: 'JavaScript基础', link: '/study/front-end/js-basics' },
      //           { text: 'LeetCode轮转数组', link: '/study/front-end/leetcode-rotate-array' },
      //           { text: '算法题解集锦', link: '/study/front-end/algorithm-solutions' },
      //           { text: 'Vue.js入门指南', link: '/study/front-end/vue-intro' },
      //           { text: 'React基础入门', link: '/study/front-end/react-basics' }
      //         ]
      //       }
      //     ]
      //   },
      //   {
      //     text: '后端',
      //     items: [
      //       {
      //         text: 'Node.js',
      //         items: [
      //           { text: 'Node.js基础', link: '/study/back-end/nodejs-basics' }
      //         ]
      //       },
      //       {
      //         text: '数据库',
      //         items: [
      //           { text: 'MySQL基础教程', link: '/study/back-end/mysql-basics' }
      //         ]
      //       }
      //     ]
      //   },
      //   {
      //     text: '工具与部署',
      //     items: [
      //       {
      //         text: '开发工具',
      //         items: [
      //           { text: 'Git使用指南', link: '/study/tools-deploy/git-guide' }
      //         ]
      //       },
      //       {
      //         text: '部署工具',
      //         items: [
      //           { text: 'Docker容器化部署指南', link: '/study/tools-deploy/docker-guide' }
      //         ]
      //       }
      //     ]
      //   }
      // ],
      // '/back-end': [
      //   {
      //     text: '前端',
      //     items: [
      //       {
      //         text: 'HTML相关',
      //         items: [
      //           { text: 'HTML基础', link: '/study/front-end/html-basic' }
      //         ]
      //       },
      //       {
      //         text: 'CSS相关',
      //         items: [
      //           { text: 'CSS基础', link: '/study/front-end/css-basic' }
      //         ]
      //       },
      //       {
      //         text: 'JavaScript相关',
      //         items: [
      //           { text: 'JavaScript基础', link: '/study/front-end/js-basics' },
      //           { text: 'LeetCode轮转数组', link: '/study/front-end/leetcode-rotate-array' },
      //           { text: '算法题解集锦', link: '/study/front-end/algorithm-solutions' },
      //           { text: 'Vue.js入门指南', link: '/study/front-end/vue-intro' },
      //           { text: 'React基础入门', link: '/study/front-end/react-basics' }
      //         ]
      //       }
      //     ]
      //   },
      //   {
      //     text: '后端',
      //     items: [
      //       {
      //         text: 'Node.js',
      //         items: [
      //           { text: 'Node.js基础', link: '/study/back-end/nodejs-basics' }
      //         ]
      //       },
      //       {
      //         text: '数据库',
      //         items: [
      //           { text: 'MySQL基础教程', link: '/study/back-end/mysql-basics' }
      //         ]
      //       }
      //     ]
      //   },
      //   {
      //     text: '工具与部署',
      //     items: [
      //       {
      //         text: '开发工具',
      //         items: [
      //           { text: 'Git使用指南', link: '/study/tools-deploy/git-guide' }
      //         ]
      //       },
      //       {
      //         text: '部署工具',
      //         items: [
      //           { text: 'Docker容器化部署指南', link: '/study/tools-deploy/docker-guide' }
      //         ]
      //       }
      //     ]
      //   }
      // ],
      // '/tools-deploy': [
      //   {
      //     text: '前端',
      //     items: [
      //       {
      //         text: 'HTML相关',
      //         items: [
      //           { text: 'HTML基础', link: '/study/front-end/html-basic' }
      //         ]
      //       },
      //       {
      //         text: 'CSS相关',
      //         items: [
      //           { text: 'CSS基础', link: '/study/front-end/css-basic' }
      //         ]
      //       },
      //       {
      //         text: 'JavaScript相关',
      //         items: [
      //           { text: 'JavaScript基础', link: '/study/front-end/js-basics' },
      //           { text: 'LeetCode轮转数组', link: '/study/front-end/leetcode-rotate-array' },
      //           { text: '算法题解集锦', link: '/study/front-end/algorithm-solutions' },
      //           { text: 'Vue.js入门指南', link: '/study/front-end/vue-intro' },
      //           { text: 'React基础入门', link: '/study/front-end/react-basics' }
      //         ]
      //       }
      //     ]
      //   },
      //   {
      //     text: '后端',
      //     items: [
      //       {
      //         text: 'Node.js',
      //         items: [
      //           { text: 'Node.js基础', link: '/study/back-end/nodejs-basics' }
      //         ]
      //       },
      //       {
      //         text: '数据库',
      //         items: [
      //           { text: 'MySQL基础教程', link: '/study/back-end/mysql-basics' }
      //         ]
      //       }
      //     ]
      //   },
      //   {
      //     text: '工具与部署',
      //     items: [
      //       {
      //         text: '开发工具',
      //         items: [
      //           { text: 'Git使用指南', link: '/study/tools-deploy/git-guide' }
      //         ]
      //       },
      //       {
      //         text: '部署工具',
      //         items: [
      //           { text: 'Docker容器化部署指南', link: '/study/tools-deploy/docker-guide' }
      //         ]
      //       }
      //     ]
      //   }
      // ]
    }
  }
})
