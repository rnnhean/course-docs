[00:00] All right, all right, hello everybody, welcome back. So previously we covered some really important high-level concurrency APIs, like the executive framework, concurrent collections, future and callable interfaces, and atomic variables. Now these are very powerful tools that make working with threads and concurrency and Java much easier and more efficient.
[00:26] But now my friends we're gonna get our hands dirty and actually write code for the executor framework using IntelliJ. We're gonna see how to manage multiple tasks efficiently using thread pools. It's a great way to take control of thread management and improve performance. So let's dive right into the code and see how to implement an executor service step by step. So here you see I've opened IntelliJ.
[00:52] And I'll create a new project named Executor Example. And in our IntelliJ project...
[01:10] Create a new Java class named Executor Service Example. Start by importing the required packages. These are...
[01:37] Java.util.concurrent.executorService. And this is the interface that we're going to use to manage thread pools. Java.util.concurrent.executors.
[02:07] A factory class that provides useful methods to create different kinds of thread pools. Java.util.concurrent.timeUnit. This is used for time conversions when shutting down the executor.
[02:33] Now we're going to create a task that will be run by the executor service. So we're creating a class named task that implements the runnable interface.
[02:53] In Java, runnable is an interface that defines a single method, run. So when a class implements runnable, it must provide an implementation of the run method. And this, of course, is especially useful when you wanna execute code in a separate thread. And next, we'll add a private field named
[03:22] task name. So this field is going to hold the name of the task we're going to run. Each instance of the task class will have a unique task name, and that will help us identify which task is being executed by a particular thread.
[03:48] So now let's add a constructor to the class. And the constructor of course is responsible for initializing the task name when we create a new instance of the task class. We pass the task name as a parameter and the constructor assigns it.
[04:15] to the task name field. Now, since we're implementing the runnable interface, we must provide the implementation for the run method. This is where the logic of the task will be defined. Inside the run method, we first print a message to the console. This message tells us that the task is starting, showing both the task name
[04:42] and the name of the thread executing it. We get the current thread's name using thread.currentthread.getname. Excellent.
[05:10] Now to simulate the task doing some actual work, we use thread.sleep write2000, which pauses the execution of the current thread for two seconds. And this delay represents some time-consuming operation. However, calling sleep can throw an interrupted exception. So we need to wrap this part of the code in a try catch block.
[05:34] to handle any interruptions that might occur while the thread is sleeping. And after the simulator work is done, after the two-second delay, we print another message to the console indicating that the task is complete.
[05:59] And we again include the task name in the message just to indicate which task is finished. All right, so let's just summarize this code. See what we've got. You can see we've created a task class that implements Runnable, and each task has a task name to identify it.
[06:27] Then the run method prints a message when the task starts, simulates work with a 2-second sleep, and prints a message when the task is complete.
[06:48] So in this code, we are creating a fixed thread pool with three threads using the executor service. The executor service manages a pool of threads and allows us to submit tasks for execution. We're actually submitting six tasks to the executor service.
[07:18] Each task is created by instantiating the task class, which we discussed earlier. And these tasks are executed by the thread pool, where three threads
[07:45] will run tasks in parallel. Once a thread finishes a task, it picks up another from the queue.
[08:06] We use a wait termination to make the program wait for 60 seconds for all tasks to complete.
[08:30] If the tasks take too long.
[08:37] We can forcefully shut down the executor using shutdown now.
[09:06] you
[09:22] you
[09:52] Alright my friends, so in this video we learned how to use the executor service to manage a pool of threads and run tasks concurrently. We started by creating a fixed thread pool, then submitted multiple tasks to it and finally shut down the executor gracefully.
[10:21] See this approach is very useful when we have a limited number of threads but need to run many tasks in parallel. But we also saw how to handle graceful shutdown and how to forcefully stop tasks if they exceed a certain time limit. Now when we come back, we're going to be talking about scheduled executor. So I'll see you next video.
[10:44] you
