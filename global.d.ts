// 全局类型声明文件

// CSS 模块声明
declare module "*.css" {
  const content: { [className: string]: string }
  export default content
}

// 图片文件声明
declare module "*.png" {
  const value: string
  export default value
}

declare module "*.jpg" {
  const value: string
  export default value
}

declare module "*.jpeg" {
  const value: string
  export default value
}

declare module "*.gif" {
  const value: string
  export default value
}

declare module "*.svg" {
  const value: string
  export default value
}

declare module "*.webp" {
  const value: string
  export default value
}

// 字体文件声明
declare module "*.ttf" {
  const value: string
  export default value
}

declare module "*.woff" {
  const value: string
  export default value
}

declare module "*.woff2" {
  const value: string
  export default value
}

declare module "*.eot" {
  const value: string
  export default value
}

declare module "*.otf" {
  const value: string
  export default value
}
