[00:00] Alright, let's actually put Sodelik into action. Earlier we created our customer onboarding use case where we define goals, actors, triggers, happy path, variations and the business rules. Now what I will do is I'll simply copy the entire use case and I will map it under the requirements section of Sodelik. I'll go here
[00:28] I'll click on add which means I need to add a new requirement I'll give it a name and I will paste the description here set the priority as must have
[00:58] and I'll just go and say create now I go under the requirement section I can see my use case requirement created now you can notice this shows up as draft that's the default when we capture an idea okay and now
[01:26] what we need to do is I need to wear my product owner hat and move the requirement from draft stage to in scope stage. All right, so my requirement is back on track and now it's in scope.
[01:53] Now from this requirement let's derive the first feature and think of register customer as my first feature so I'll come here I'll say add features and I'll give it a title
[02:22] description will say and the mandatory fields will be first name
[02:52] last name email address phone and customer ID
[03:13] let's define the acceptance criteria request with valid fields creates a new row in the customers
[03:42] Table Duplicate Email Should get 49 Error Duplicate Customer ID Again 49 Error
[04:11] response should return a 201 created. All right it's enough for now let's say oh we'll give up finished it we'll say 30th September category let's leave it for now
[04:41] Let's leave it for now. Let's say create. Now if I go to my feature section. I can say register customer feature is added. And as you can see, this is still in draft mode.
[05:08] So what I'll do is I'll mark it from draft mode to in scope mode All right, let's take a look now So you can see under my requirements There is a new feature added called register customer All right, this looks good
[05:35] Next, I break this feature down into tasks, the real actionable work items. I'll add the first task. Insert a new record with KYC.
[06:04] Tending into the customers table Sanit to myself say I'll finish by 30th and I'll add the first task Okay, you can see task is added successfully I can see the first task created less let's create more tasks
[06:33] implement duplicate email handling again I'll assign it to myself and finish by the state add task to created and I'll add just one more task implement duplicate
[07:00] External ID Handling again, I'm using external ID and customer ID interchangeably Again, I finished by 30th and I'll Add these tasks Now these tasks are the pieces developers will normally pull into a sprint
[07:30] In my case, since I am the only developer here, I'll be picking up all these myself, which means pretty soon I'll be switching over and putting on my developer hat. I'll pause the video here and take a moment to write out the full set of features inside Sodelik. When we come back, we'll continue our journey and start turning these into real code.
[07:56] you
