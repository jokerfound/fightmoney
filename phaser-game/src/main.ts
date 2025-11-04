import Phaser from 'phaser';
import GameScene from './scenes/GameScene';
import MenuScene from './scenes/MenuScene';
import WarehouseScene from './scenes/WarehouseScene';
import ShopScene from './scenes/ShopScene';
import BootScene from './scenes/BootScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1920,
    height: 1080,
    // 性能优化配置
    fps: {
        target: 60,
        forceSetTimeOut: false
    },
    render: {
        pixelArt: false,
        antialias: true,
        antialiasGL: true,
        powerPreference: 'high-performance',
        batchSize: 4096,
        maxTextures: 16
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false, // 关闭 debug 以提升性能
            fps: 60,
            fixedStep: true
        }
    },
    // 输入优化
    input: {
        activePointers: 3,
        smoothFactor: 0.2 // 鼠标平滑系数
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