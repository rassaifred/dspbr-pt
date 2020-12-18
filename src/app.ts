/* @license
 * Copyright 2020  Dassault Systemes - All Rights Reserved.
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// import "core-js/stable";
// import 'regenerator-runtime/runtime'
import Stats from 'three/examples/jsm/libs/stats.module.js';
import { GUI } from 'dat.GUI';
import scene_index from '../assets/scenes/scene_index.js';
import ibl_index from '../assets/env/ibl_index.js';
import * as loader from './scene_loader';
import { ThreeRenderer } from '../lib/three_renderer';
import { PathtracingRenderer } from '../lib/renderer';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

if (window.File && window.FileReader && window.FileList && window.Blob) {
  // Great success! All the File APIs are supported.
} else {
  alert('The File APIs are not fully supported in this browser.');
}


function getFileExtension(filename: string) {
  return filename.split('.').pop();
}

class App {
  _gui: any;
  _stats: any | null;
  canvas: HTMLCanvasElement;
  canvas_three: HTMLCanvasElement;
  canvas_pt: HTMLCanvasElement;
  container: HTMLElement | null;
  Scene: string;
  IBL: string;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;

  renderer: any;
  three_renderer: ThreeRenderer;

  useControls: true;
  pathtracing = true;
  autoScaleScene = true;
  autoRotate = false;
  interactionScale = 0.2;

  sceneBoundingBox: THREE.Box3;

  constructor() {
    this.Scene = Object.values<string>(scene_index)[0];
    this.IBL = Object.values<string>(ibl_index)[0];

    this.container = document.createElement('div');
    document.body.appendChild(this.container);
    this.canvas = document.createElement('canvas');
    this.container.appendChild(this.canvas);

    this.canvas_pt = document.createElement('canvas');
    this.canvas_three = document.createElement('canvas');

    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas_pt.width = window.innerWidth;
    this.canvas_pt.height = window.innerHeight;
    this.canvas_three.width = window.innerWidth;
    this.canvas_three.height = window.innerHeight;

    this._stats = new (Stats as any)();
    this._stats.domElement.style.position = 'absolute';
    this._stats.domElement.style.top = '0px';
    this._stats.domElement.style.cursor = "default";
    this._stats.domElement.style.webkitUserSelect = "none";
    this._stats.domElement.style.MozUserSelect = "none";
    this.container.appendChild(this._stats.domElement);

    let aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(45, aspect, 0.01, 1000);
    this.camera.position.set(0, 0, 3);

    this.controls = new OrbitControls(this.camera, this.canvas);
    this.controls.screenSpacePanning = true;

    let _this = this;
    this.controls.addEventListener('change', () => {
      _this.camera.updateMatrixWorld();
      _this.renderer.resetAccumulation();
    });

    this.controls.addEventListener('start', () => {
      this["renderScale"] = _this.renderer.renderScale;
      _this.renderer.renderScale = _this.interactionScale;
    });

    this.controls.addEventListener('end', () => {
      _this.renderer.renderScale = this["renderScale"];
    });

    this.controls.mouseButtons = {
      LEFT: THREE.MOUSE.ROTATE,
      MIDDLE: THREE.MOUSE.PAN,
      RIGHT: THREE.MOUSE.DOLLY
    }

    this.renderer = new PathtracingRenderer(this.canvas_pt, window.devicePixelRatio);
    this.three_renderer = new ThreeRenderer(this.canvas_three, window.devicePixelRatio);
    _this.loadScene(this.Scene);

    this.renderer.renderScale = 0.5;

    window.addEventListener('resize', () => {
      _this.resize();
    }, false);

    this.container.addEventListener('dragover', function (e) {
      e.stopPropagation();
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });

    this.canvas.addEventListener('drop', function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (e.dataTransfer.files.length == 1 &&
        getFileExtension(e.dataTransfer.files[0].name) == "hdr") {
        console.log("loading HDR...");
        // const url = URL.createObjectURL(e.dataTransfer.getData('text/html'));
        loader.loadIBL(URL.createObjectURL(e.dataTransfer.items[0].getAsFile()), (ibl) => {
          _this.renderer.setIBL(ibl);
          _this.three_renderer.setIBL(ibl);
        });
      } else {
        loader.loadSceneFromBlobs(e.dataTransfer.files, _this.autoScaleScene, function (scene) {
          loader.loadIBL(_this.IBL, (ibl) => {
            _this.sceneBoundingBox = new THREE.Box3().setFromObject(scene);
            _this.renderer.setIBL(ibl);
            _this.renderer.setScene(scene, () => {
              _this.startPathtracing();
            })
            _this.three_renderer.setScene(scene, () => {
              _this.three_renderer.setIBL(ibl);
            });
          });
        });
      }
    });

    this.initUI();
  }

  private startRasterizer() {
    let _this = this;
    this.stopPathtracing();
    this.three_renderer.render(this.camera, () => {
      var destCtx = _this.canvas.getContext("2d");
      destCtx.drawImage(_this.canvas_three, 0, 0);
    });
  }

  private stopRasterizer() {
    this.three_renderer.stopRendering();
  }

  private stopPathtracing() {
    this.renderer.stopRendering();
  }

  private startPathtracing() {
    this.stopRasterizer();

    let _this = this;
    _this.renderer.render(_this.camera, -1, () => {
      _this.controls.update();
      _this._stats.update();
      if (_this.pathtracing) {
        var destCtx = _this.canvas.getContext("2d");
        destCtx.drawImage(_this.canvas_pt, 0, 0);
      }
    })
  }

  private resize() {
    console.log("resizing", window.innerWidth, window.innerHeight);
    let res = [window.innerWidth, window.innerHeight];
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas_pt.width = window.innerWidth;
    this.canvas_pt.height = window.innerHeight;
    this.canvas_three.width = window.innerWidth;
    this.canvas_three.height = window.innerHeight;

    this.renderer.resize(window.innerWidth, window.innerHeight);
    this.three_renderer.resize(window.innerWidth, window.innerHeight);

    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
  }

  private loadScene(url) {
    loader.loadScene(url, this.autoScaleScene, (scene) => {
      loader.loadIBL(this.IBL, (ibl) => {
        this.sceneBoundingBox = new THREE.Box3().setFromObject(scene);
        this.renderer.setIBL(ibl);
        this.renderer.setScene(scene, () => {
          if (this.pathtracing)
            this.startPathtracing();
        })

        this.three_renderer.setScene(scene, () => {
          this.three_renderer.setIBL(ibl);
        });

        if (!this.pathtracing)
          this.startRasterizer();
      });
    });
  }

  initUI() {
    if (this._gui)
      return;

    let _this = this;

    this._gui = new GUI();
    this._gui.domElement.classList.add("hidden");
    this._gui.width = 300;
    this._gui.add(this, "Scene", scene_index).onChange(function (value) {
      console.log(`Loading ${value}`);
      _this.loadScene(value);
    });
    this._gui.add(this, 'autoScaleScene').name('Autoscale Scene');

    this._gui.add(this, "IBL", ibl_index).onChange(function (value) {
      console.log(`Loading ${value}`);
      loader.loadIBL(_this.IBL, (ibl) => {
        _this.renderer.setIBL(ibl);
        _this.three_renderer.setIBL(ibl);
      });
    });

    this._gui.add(_this.renderer, 'exposure').name('Display Exposure').min(0).max(10).step(0.1).onChange(function (value) {
      _this.three_renderer.setExposure(value);
    });

    this._gui.add(this, 'autoRotate').name('Auto Rotate').onChange(function (value) {
      _this.controls.autoRotate = value;
      _this.renderer.resetAccumulation();
    });

    this._gui.add(_this.renderer, 'debugMode', this.renderer.debugModes).name('Debug Mode');
    this._gui.add(_this.renderer, 'tonemapping', this.renderer.tonemappingModes).name('Tonemapping');
    this._gui.add(_this.renderer, 'enableGamma').name('Gamma');

    this._gui.add(_this.renderer, 'renderScale').name('Render Res X').min(0.1).max(1.0);
    this._gui.add(this, 'interactionScale').name('Interaction Res X').min(0.1).max(1.0).step(0.1);

    this._gui.add(_this.renderer, 'useIBL').name('Use IBL');
    this._gui.add(_this.renderer, 'disableBackground').name('Disable Background').onChange((value) => {
      _this.three_renderer.setDisableBackground(value);
    });

    this._gui.add(this, 'pathtracing').name('Use Pathtracing').onChange((value) => {
      if (value == false) {
        _this.startRasterizer();
      } else {
        _this.startPathtracing();
      }
    });

    this._gui.add(_this.renderer, 'forceIBLEval').name('Force IBL Eval');
    this._gui.add(_this.renderer, 'maxBounces').name('Bounce Depth').min(0).max(16).step(1);

    let reload_obj = {
      reload: () => {
        console.log("Reload");
        this.loadScene(this.Scene);
      }
    };
    this._gui.add(reload_obj, 'reload').name('Reload');

    const center_obj = {
      centerView: () => {
        console.log("center view");
        if (this.controls) {
          let center = new THREE.Vector3();
          this.sceneBoundingBox.getCenter(center);
          this.controls.target = center;
          this.controls.update();
          this.renderer.resetAccumulation();
        }
      }
    };
    this._gui.add(center_obj, 'centerView').name('Center View');

    // const save_img = {
    //   save_img: () => {
    //     console.log("Reload");
    //     var dataURL = this.canvas.toDataURL('image/png');
    //   }
    // };
    // this._gui.add(save_img, 'save_img').name('Save PNG');
  }
  // setLookAt(from, at, up) {
  //   this.camera.position.set(from[0] * this.sceneScaleFactor, from[1] * this.sceneScaleFactor, from[2] * this.sceneScaleFactor);
  //   this.camera.up.set(up[0], up[1], up[2]);
  //   this.camera.lookAt(at[0] * this.sceneScaleFactor, at[1] * this.sceneScaleFactor, at[2] * this.sceneScaleFactor);
  //   this.camera.updateMatrixWorld();
  //   if (this.controls) this.controls.update();
  // }

  // setPerspective(vFov, near, far) {
  //   this.camera.fov = vFov;
  //   this.camera.near = near;
  //   this.camera.far = far;
  //   this.camera.updateProjectionMatrix();
  // }
}

let app = new App();