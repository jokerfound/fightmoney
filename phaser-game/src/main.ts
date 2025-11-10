import Phaser from 'phaser';
import GameScene from './scenes/GameScene';
import MenuScene from './scenes/MenuScene';
import WarehouseScene from './scenes/WarehouseScene';
import ShopScene from './scenes/ShopScene';
import BootScene from './scenes/BootScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL, // 强制使用 WebGL 以获得最佳性能
    width: 1920,
    height: 1080,
    // 缩放配置 - 响应式布局
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: '100%',
        height: '100%'
    },
    // 性能优化配置
    fps: {
        target: 60,
        forceSetTimeOut: false,
        smoothStep: true, // 平滑帧率
        deltaHistory: 10, // 记录最近10帧的delta用于平滑
        panicMax: 120, // 如果delta超过120ms则进入恐慌模式
        min: 10 // 最小帧时间10ms
    },
    // 渲染质量优化
    render: {
        pixelArt: false,
        antialias: true,
        antialiasGL: true,
        powerPreference: 'high-performance',
        batchSize: 16384, // 翻倍批处理大小，大幅提升渲染性能
        maxTextures: 64, // 增加最大纹理数量
        maxLights: 10, // 限制最大光源数量
        roundPixels: false,
        clearBeforeRender: true,
        preserveDrawingBuffer: false,
        premultipliedAlpha: false,
        failIfMajorPerformanceCaveat: false,
        mipmapFilter: 'LINEAR' // 使用线性过滤获得更好的性能
    },
    // 物理引擎优化
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false,
            fps: 60,
            fixedStep: true,
            timeScale: 1.0,
            overlapBias: 4,
            tileBias: 16,
            forceX: false,
            isPaused: false
        }
    },
    // 输入优化 - 大幅提升鼠标响应速度
    input: {
        activePointers: 3,
        smoothFactor: 0, // 完全禁用鼠标平滑，获得即时响应
        mouse: true,
        touch: true,
        gamepad: false
    },
    // 音频优化
    audio: {
        disableWebAudio: false,
        context: undefined,
        noAudio: false
    },
    // 其他优化
    backgroundColor: '#000000',
    autoFocus: true,
    disableContextMenu: true,
    banner: false,
    // DOM优化
    dom: {
        createContainer: false
    },
    // 加载器优化
    loader: {
        baseURL: '',
        path: '',
        maxParallelDownloads: 32, // 增加并行下载数
        crossOrigin: undefined,
        timeout: 0
    },
    scene: [
        BootScene,
        MenuScene,
        GameScene,
        WarehouseScene,
        ShopScene
    ]
};

const game = new Phaser.Game(config);

export default game;