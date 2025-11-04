import Phaser from 'phaser';

export const GameConfig: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO, // 自动选择WEBGL或CANVAS，优先WEBGL
    width: 1024, // 增加分辨率
    height: 768,
    parent: 'game-container',
    backgroundColor: '#0a0a0a', // 更深的背景色
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        }
    },
    scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
        width: '100%',
        height: '100%'
    },
    render: {
        antialias: true, // 启用抗锯齿
        pixelArt: false, // 禁用像素艺术模式以获得更平滑的图形
        roundPixels: true // 像素对齐
    },
    scene: [], // 将在main.ts中动态添加
    // WebGL配置优化
    canvasStyle: 'display: block;',
    autoFocus: true,
    // 防止WebGL初始化错误
    failIfMajorPerformanceCaveat: false,
    powerPreference: 'default'
};

// 游戏常量配置
export const GameConstants = {
    // 玩家配置
    PLAYER: {
        SPEED: 200,
        HEALTH: 100,
        COLLIDER_RADIUS: 20
    },
    
    // 敌人配置
    ENEMY: {
        SPEED: 100,
        HEALTH: 50,
        DETECTION_RANGE: 200,
        ATTACK_RANGE: 100,
        DAMAGE: 10
    },
    
    // 物资配置
    ITEM_TYPES: {
        WEAPON: 'WEAPON',
        AMMO: 'AMMO',
        ARMOR: 'ARMOR',
        MEDICAL: 'MEDICAL',
        FOOD: 'FOOD',
        VALUABLE: 'VALUABLE'
    },
    
    // 地图配置
    MAP: {
        TILE_SIZE: 32,
        WALL_COLOR: 0x4a5568,
        FLOOR_COLOR: 0x2d3748,
        WALL_SHADOW_COLOR: 0x2d3748,
        FLOOR_PATTERN_COLOR: 0x4a5568,
        WIDTH: 1600,
        HEIGHT: 1200
    },
    
    // 游戏配置
    GAME: {
        MAX_ITEMS: 20,
        EXTRACTION_TIME: 300, // 5分钟游戏时间
        WIN_CONDITION: 10 // 收集10个物品获胜
    }
};