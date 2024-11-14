const { PromptTemplate } = require("@langchain/core/prompts");
const { ChatOpenAI } = require("@langchain/openai");
require('dotenv').config();

// Define an output parser
const parseOutput = (output) => {
    // Example: Extract a specific key-value pair from the output
    // This is a simple example; adjust the logic based on your output format
    const parsedResult = output.match(/key:\s*(\w+)/);
    return parsedResult ? parsedResult[1] : "default_value";
};

const getTextHints = async (elementMetadata, config) => {
    const promptTemplate = `Based on the following metadata of an element: {{elementMetadata}} 
    and config that most likely has data for this element: {{config}}
    Please return the value of the most appropriate key. 
    If no relevant key is found, return a default value based on your knowledge.`;

    const prompt = new PromptTemplate({
        template: promptTemplate,
        inputVariables: ['elementMetadata', 'config'],
    });

    // Create the LLM chain
    const llm = new ChatOpenAI(); // Initialize OpenAI instance

    const chain = prompt.pipe(llm);
    // Run the chain with the provided metadata and config
    const result = await chain.invoke({
        elementMetadata: JSON.stringify(elementMetadata),
        config: JSON.stringify(config),
    });
    console.log(result);
    // Use the output parser
    return parseOutput(result.text.trim());
}

// Example usage
const elementMetadata = {
    id: "button_123",
    type: "input",
    label: "email",
    action: "enter email"
};

const config = {
    email: "test@test.com",
    password: "test1234",
    name: "test"
    // Add your config data here
};

getTextHints(elementMetadata, config).then(result => {
    console.log("Returned value:", result);
});