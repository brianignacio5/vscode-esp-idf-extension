<template>
  <div id="templates">
    <label for="idf-category">Select category:</label>
    <br />
    <br />
    <select v-model="selectedTemplateCategory" id="idf-category">
      <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
    </select>
    <br />
    <br />
    <label for="template">Select template:</label>
    <br />
    <br />
    <select v-model="selectedTemplate" id="template">
      <option
        v-for="template in templates"
        :key="template.name"
        :value="template"
        >{{ template.name }}</option
      >
    </select>
    <br />
    <br />
    <router-link to="/components" class="button">Add component</router-link>
  </div>
</template>

<script lang="ts">
import { Component, Vue } from "vue-property-decorator";
import { Action, Mutation, State } from "vuex-class";
import { IExample } from "../../examples/Examples";
export default class Templates extends Vue {
  @Action private loadExamples;
  @State("templates") private storeTemplates: IExample[];
  @State("selectedTemplateCategory")
  private storeSelectedTemplateCategory: string;
  @State("selectedTemplate") private storeSelectedTemplate: IExample;
  @Mutation private setSelectedTemplate;
  @Mutation private setSelectedCategory;

  private mounted() {
    this.loadExamples();
  }

  get categories() {
    const allCategories = this.storeTemplates.map((t) => t.category);
    const categories = [...new Set(allCategories)];
    return categories;
  }

  get templates() {
    return this.storeTemplates.filter(
      (t) => t.category === this.storeSelectedTemplateCategory
    );
  }

  get selectedTemplateCategory() {
    return this.storeSelectedTemplateCategory;
  }
  set selectedTemplateCategory(category: string) {
    const template = this.storeTemplates.find((t) => t.category === category);
    this.setSelectedTemplate(template);
    this.setSelectedCategory(category);
  }

  get selectedTemplate() {
    return this.storeSelectedTemplate;
  }
}
</script>

<style scoped></style>
