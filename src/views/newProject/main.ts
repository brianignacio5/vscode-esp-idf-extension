// Copyright 2019 Espressif Systems (Shanghai) CO LTD
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { library } from "@fortawesome/fontawesome-svg-core";
import { FontAwesomeIcon } from "@fortawesome/vue-fontawesome";
import Vue from "vue";
import VueRouter from "vue-router";
import App from "./App.vue";
import EspIdf from "./EspIdf.vue";
import Tool from "./components/tool.vue";
import Templates from "./Templates.vue";
import { store } from "./store";
import {
  faArrowLeft,
  faCheck,
  faFolder,
  faFolderOpen,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";

const routes = [
  { path: "/template", component: Templates },
  { path: "/", component: EspIdf },
];

Vue.use(VueRouter);

const router = new VueRouter({
  routes,
  base: __dirname,
});

library.add(faArrowLeft, faCheck, faFolder, faFolderOpen, faTimes);
Vue.component("font-awesome-icon", FontAwesomeIcon);
Vue.component("tool", Tool);

new Vue({
  el: "#app",
  components: { App },
  store,
  router,
  template: "<App />",
});

window.addEventListener("message", (event) => {
  const message = event.data;
  switch (message.command) {
    case "idf_tools_check_done":
      if (message.allIsValid) {
        store.commit("setIsValid", message.allIsValid);
      }
      break;
    case "load_examples":
      if (message.examples) {
        store.commit("setTemplates", message.examples);
      }
    case "load_idf_versions":
      if (message.idfVersions) {
        store.commit("setIdfVersions", message.idfVersions);
      }
      if (message.selectedIdf) {
        store.commit("setSelectedIdf", message.selectedIdf);
      }
      break;
    case "load_py_venvs":
      if (message.pyVenvList) {
        store.commit("setPyEnvList", message.pyVenvList);
      }
      if (message.selectedVenv) {
        store.commit("setSelectedVenv", message.selectedVenv);
      }
      break;
    case "load_tools_list":
      if (message.tools) {
        store.commit("setToolsList", message.tools);
      }
      break;
    default:
      break;
  }
});
