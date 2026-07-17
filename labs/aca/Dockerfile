# Use the official, lightweight Node.js 20 Alpine image
FROM node:20-alpine

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy package.json and package-lock.json first to leverage Docker layer caching
# Note: You will need to run 'npm init -y' and 'npm install express @azure/openai' locally first
COPY package*.json ./

# Install production dependencies only
RUN npm ci --only=production

# Copy the rest of the application code (app.js)
COPY . .

# Expose the port the app runs on (matches the PORT env variable in code)
EXPOSE 8080

# Define the command to run the application
CMD [ "node", "index.js" ]