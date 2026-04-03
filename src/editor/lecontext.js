import * as PIXI from 'pixi.js'
import * as CONFIG from './leconfig.js'

var ContextCreate = (function(){

    function ContextSingleton() {
        this.tilesetpxw = 0;
        this.tilesetpxh = 0;
        this.tilesettilew = 0;
        this.tilesettileh = 0;
        this.MAXTILEINDEX = 0;
        this.tile_index = 0;
        this.selected_tiles = []; // current set of selected tiles
        this.spritesheet = null; // loaded spritesheet
        this.tiledimx = CONFIG.DEFAULTILEDIMX ; // px
        this.tiledimy = CONFIG.DEFAULTILEDIMY; // px
        this.dimlog = Math.log2(this.tileDim);  //log2(TileDim)
        this.dkey = false;   // is 'd' key depressed? (for delete)
        this.tiles32  = [];  // all tiles from tilemap (32x32)
        this.tiles16  = []; 
        this.fudgetiles = [];
        this.g_layers = []; // level layers

        // Scene mode state
        this.sceneMode = false;
        this.sceneName = '';
        this.sceneDisplayName = '';
        this.sceneWidth = 10;       // tiles
        this.sceneHeight = 8;       // tiles
        this.furniture = [];        // [{id, name, type, x, y, w, h, action, config}]
        this.spawnPoint = null;     // {x, y}
        this.exitPoint = null;      // {x, y}
        this.collisionOverlay = false;
        this.furnitureMode = false;
        this.selectedFurnitureTemplate = null;
        this.spawnMode = false;     // placing spawn point
        this.exitMode = false;      // placing exit point
        this.convexUrl = '';
        this.worldId = '';
    }

    var instance;
    return {
        getInstance: function(){
            if (instance == null) {
                instance = new ContextSingleton();
                // Hide the constructor so the returned object can't be new'd...
                instance.constructor = null;
            }
            return instance;
        }
   };
})();

// global shared state between all panes
export let g_ctx = ContextCreate.getInstance();