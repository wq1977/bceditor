# 一个简单的播客声音编辑器

通过腾讯云的语音转文本服务将语音转为文本后，用编辑文本的方式编辑声音。

目前仅支持中国大陆普通话，仅支持采样率44100hz单声道声音

## 使用方法

在主目录创建配置文件 .bceditor.json

{
"tbucket": "xxx-xxxxxxx",
"tzone": "ap-beijing",
"tsid": "xxxxxxx",
"tkey": "xxxxxxx"
}

运行本程序即可
