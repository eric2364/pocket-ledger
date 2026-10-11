const config=require('./app.json').expo;
module.exports={...config,experiments:{...config.experiments,baseUrl:process.env.EXPO_PUBLIC_BASE_PATH||''}};
