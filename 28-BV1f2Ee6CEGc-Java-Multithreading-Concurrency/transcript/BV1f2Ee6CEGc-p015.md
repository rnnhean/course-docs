[00:00] All right everybody, welcome back. So previously we talked about concurrent collection like concurrent hash map. So in this video, we're going to introduce the future and callable interfaces, which will allow us to perform tasks asynchronously and retrieve the results later. We'll get into how callable is different from runnable because it returns a result.
[00:25] and how to use Future to get the result once the task is complete. So I'm going to want to create a project in IntelliJ now. I'll create a project named Future Callable Example.
[00:52] So we'll begin here by creating a fixed thread pool with three threads using executors.NewFixedThreadPool and put three threads.
[01:15] The executive service will manage the threads and execute tasks in the background. So, did we already say why three threads? It means that up to three tasks can run in parallel. And if more tasks are submitted, they'll be queued until a thread becomes available.
[01:38] And now we can create a callable task.
[02:08] you
[02:15] you
[02:45] So unlike Runnable, a callable can return a result or throw an exception. So here the callable is a lambda expression that prints the thread name, simulates some more with the thread.sleep and put 2000 and returns a result. Now, what really is callable? It is like Runnable.
[03:12] But it can return a result. So in this case, we return a string indicating which thread executed the task. Excellent. So next, we'll submit the callable task to the executor service. When we submit a task,
[03:42] It returns a future object. This future represents the result of the asynchronous computation. So it's going to allow us to retrieve the result once the task is complete. Future actually allows us to check the task's progress, cancel it, as well as retrieve its result once the task finishes.
[04:12] Submit callable task. This method submits the task to one of the available threads in the thread pool. All right, so now the task has been submitted. We can perform other operations in the main thread while the callable task is being executed by one of the pool threads. And this will demonstrate that the main thread is not blocked by the task's execution.
[04:38] You can actually add in any code here that the main thread should be doing while the task is running in the background. And once we're ready to retrieve the result of the task, you can go ahead and use the get method on the future object. So this method blocks the main thread until the task completes and the result is available.
[05:07] FutureResult.get will block the main thread until the task completes. Once the task is done, the result is returned. And of course, we can now print it.
[05:30] So once all the tasks are complete, we need to gracefully shut down the executor service. So we call shut down to stop accepting new tasks and wait for the already submitted tasks to finish. Shut down ensures that no new tasks are submitted.
[05:52] and the threads in the pool will finish executing the current tasks before shutting down. Alright my friends, so we'll wrap it up here but we'll be looking at atomic variables next time and that will allow us to perform thread safe operations on single variables without locking.
[06:21] It's a great way to make your code more efficient in multi-threaded environments. So stick around, I'll see you next time.
[06:27] you
